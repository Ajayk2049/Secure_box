import { FastifyRequest, FastifyReply } from "fastify";
import mongoose from "mongoose";
import { Device } from "../models/Device.model.js";
import { User } from "../models/User.model.js";
import { Log } from "../models/Log.model.js";
import { commandQueueService } from "../services/commandQueue.service.js";
import { wsService } from "../services/websocket.service.js";
import { generateDeviceKey } from "./adminRequests.controller.js";

// Helper to verify user access (Primary Owner OR Co-Owner)
export function isAuthorizedUser(device: any, userId: string): boolean {
  const isOwner = device.ownerId?.toString() === userId || device.ownerId?._id?.toString() === userId;
  const isCoOwner = device.coOwners?.some((cId: any) => {
    const idStr = cId?.toString() === "[object Object]" ? cId?._id?.toString() : cId?.toString();
    return idStr === userId;
  });
  return Boolean(isOwner || isCoOwner);
}

// 1. Get all devices belonging to or shared with the logged-in user
export async function getDevices(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user as { id: string };
  const devices = await Device.find({
    $or: [{ ownerId: user.id }, { coOwners: user.id }],
  })
    .populate("ownerId", "email name")
    .populate("coOwners", "email name")
    .lean();

  const userId = (user?.id || (user as any)?._id)?.toString().trim().toLowerCase();
  const now = Date.now();

  const mapped = devices.map((d: any) => {
    const obj = { ...d };
    const ownerIdStr = (d.ownerId?._id || d.ownerId)?.toString().trim().toLowerCase();
    const isOwner = Boolean(userId && ownerIdStr && ownerIdStr === userId);
    const lastHb = d.lastHeartbeat ? new Date(d.lastHeartbeat).getTime() : 0;
    // Live freshness evaluation: if device hasn't pinged in > 5.5s, report offline immediately
    const isActuallyOnline = Boolean(d.online && (now - lastHb < 5500));
    return {
      ...obj,
      online: isActuallyOnline,
      isOwner,
      userRole: isOwner ? "Owner" : "Co-Owner",
    };
  });

  return reply.send({ devices: mapped });
}

// 2. Register or pair a new device for the logged-in user
export async function createDevice(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user as { id: string };
  const { deviceId, name } = request.body as { deviceId?: string; name?: string };

  if (!deviceId || !name) {
    return reply.status(400).send({ error: "deviceId and name are required" });
  }

  const cleanDeviceId = deviceId.trim().toUpperCase();

  const existingDevice = await Device.findOne({ deviceId: cleanDeviceId });
  if (existingDevice) {
    if (existingDevice.ownerId.toString() === user.id) {
      return reply.send({ device: existingDevice, message: "Device already registered to your account" });
    }
    return reply.status(409).send({ error: "Device ID is already claimed by another user" });
  }

  const newDevice = await Device.create({
    deviceId: cleanDeviceId,
    name: name.trim(),
    ownerId: user.id,
    coOwners: [],
    allowedSlots: 2,
    doorState: "closed",
    online: false,
    lastHeartbeat: null,
    deviceKey: generateDeviceKey(),
  });

  return reply.status(201).send({ device: newDevice, message: "Device successfully paired" });
}

// 3. User authenticated unlock command (Primary Owner OR Co-Owner only - Admins restricted)
export async function unlockDevice(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const user = request.user as { id: string; role?: string };

  if (user.role === "admin") {
    return reply.status(403).send({
      error: "Admins are strictly prohibited from unlocking customer lockers for security and privacy.",
    });
  }

  let device = null;
  if (mongoose.Types.ObjectId.isValid(id)) {
    device = await Device.findById(id);
  }
  if (!device) {
    device = await Device.findOne({ deviceId: id.toUpperCase() });
  }

  if (!device) {
    return reply.status(404).send({ error: "Device not found" });
  }

  if (!isAuthorizedUser(device, user.id)) {
    return reply.status(403).send({ error: "Not authorized to unlock this device" });
  }

  const isOwner = device.ownerId.toString() === user.id;
  const dbUser = await User.findById(user.id);
  const userName = dbUser?.name || dbUser?.email || "User";
  const userRole = isOwner ? "Owner" : "Co-Owner";

  const enqueued = commandQueueService.enqueueCommand(device.deviceId, "unlock");

  device.doorState = "open";
  device.online = true;
  await device.save();

  await Log.create({
    deviceId: device._id,
    action: "unlock",
    metadata: {
      triggeredBy: user.id,
      userName,
      userRole,
      userPhone: dbUser?.phone,
      commandId: enqueued.commandId,
      source: "mobile_app",
      deviceId: device.deviceId,
    },
  });

  const unlockCommandMsg = {
    type: "UNLOCK_COMMAND",
    deviceId: device.deviceId,
    commandId: enqueued.commandId,
    unlockedBy: userName,
    userRole,
  };
  wsService.broadcastToDevice(device.deviceId, unlockCommandMsg);

  const statusMsg = {
    type: "DEVICE_STATUS",
    deviceId: device.deviceId,
    doorState: "open",
    doorStatus: "unlocked",
    online: true,
  };
  const targets = [device.deviceId, device._id, device.ownerId, ...(device.coOwners || [])];
  wsService.broadcastToDeviceGroup(targets, statusMsg);

  return reply.send({
    success: true,
    message: "Unlock command queued successfully for device",
    commandId: enqueued.commandId,
    unlockedBy: userName,
    userRole,
    device: {
      deviceId: device.deviceId,
      name: device.name,
      doorState: device.doorState,
      online: device.online,
    },
  });
}

// 4. Get recent access & delivery logs
export async function getDeviceLogs(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const user = request.user as { id: string };

  let device = null;
  if (mongoose.Types.ObjectId.isValid(id)) {
    device = await Device.findById(id);
  }
  if (!device) {
    device = await Device.findOne({ deviceId: id.toUpperCase() });
  }

  if (!device) {
    return reply.status(404).send({ error: "Device not found" });
  }

  if (!isAuthorizedUser(device, user.id)) {
    return reply.status(403).send({ error: "Not authorized" });
  }

  const logs = await Log.find({
    $or: [{ deviceId: device._id }, { "metadata.deviceId": device.deviceId }],
    action: { $ne: "door_open" },
  })
    .sort({ timestamp: -1 })
    .limit(100);

  return reply.send({ logs });
}

// 5. Update Device / Box Name
export async function updateDeviceName(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const user = request.user as { id: string };
  const { name } = (request.body as { name?: string }) || {};

  if (!name || !name.trim()) {
    return reply.status(400).send({ error: "Device name is required" });
  }

  let device = null;
  if (mongoose.Types.ObjectId.isValid(id)) {
    device = await Device.findById(id);
  }
  if (!device) {
    device = await Device.findOne({ deviceId: id.toUpperCase() });
  }

  if (!device) {
    return reply.status(404).send({ error: "Device not found" });
  }

  if (!isAuthorizedUser(device, user.id)) {
    return reply.status(403).send({ error: "Not authorized to rename this device" });
  }

  device.name = name.trim();
  await device.save();

  return reply.send({
    success: true,
    message: "Device renamed successfully",
    device: {
      id: device._id,
      deviceId: device.deviceId,
      name: device.name,
      online: device.online,
      doorState: device.doorState,
    },
  });
}


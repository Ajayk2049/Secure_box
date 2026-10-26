import { FastifyRequest, FastifyReply } from "fastify";
import mongoose from "mongoose";
import { Device } from "../models/Device.model.js";
import { User } from "../models/User.model.js";
import { Log } from "../models/Log.model.js";
import { commandQueueService } from "../services/commandQueue.service.js";
import { wsService } from "../services/websocket.service.js";
import { deviceSocketService } from "../services/deviceSocket.service.js";
import { deviceStatusService } from "../services/deviceStatus.service.js";
import { generateDeviceKey, hashDeviceKey } from "../utils/crypto.js";

// Helper to verify user access (Primary Owner OR Co-Owner)
export function isAuthorizedUser(device: any, userId: string): boolean {
  const isOwner = device.ownerId?.toString() === userId || device.ownerId?._id?.toString() === userId;
  const isCoOwner = device.coOwners?.some((cId: any) => {
    const idStr = cId?.toString() === "[object Object]" ? cId?._id?.toString() : cId?.toString();
    return idStr === userId;
  });
  return Boolean(isOwner || isCoOwner);
}

// 1. Get all devices belonging to or shared with the logged-in user (Keys strictly excluded)
export async function getDevices(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user as { id: string };
  const devices = await Device.find({
    $or: [{ ownerId: user.id }, { coOwners: user.id }],
  })
    .select("-deviceKey -deviceKeyHash")
    .populate("ownerId", "email name")
    .populate("coOwners", "email name")
    .lean();

  const userId = (user?.id || (user as any)?._id)?.toString().trim().toLowerCase();

  const mapped = devices.map((d: any) => {
    const obj = { ...d };
    delete (obj as any).deviceKey;
    delete (obj as any).deviceKeyHash;
    const ownerIdStr = (d.ownerId?._id || d.ownerId)?.toString().trim().toLowerCase();
    const isOwner = Boolean(userId && ownerIdStr && ownerIdStr === userId);
    const isActuallyOnline = deviceStatusService.resolveDeviceOnline(d.deviceId, d.online, d.lastHeartbeat);
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

  const rawKey = generateDeviceKey();
  const newDevice = await Device.create({
    deviceId: cleanDeviceId,
    name: name.trim(),
    ownerId: user.id,
    coOwners: [],
    allowedSlots: 2,
    doorState: "closed",
    online: false,
    lastHeartbeat: null,
    deviceKeyHash: hashDeviceKey(rawKey),
  });

  const devObj = newDevice.toObject();
  delete (devObj as any).deviceKeyHash;
  delete (devObj as any).deviceKey;

  return reply.status(201).send({ device: devObj, message: "Device successfully paired" });
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

  try {
    const result = await deviceStatusService.executeUnlock(user.id, user.role || "user", id);
    return reply.send(result);
  } catch (err: any) {
    const msg = err.message || "Failed to unlock device";
    if (msg.includes("not found")) return reply.status(404).send({ error: msg });
    if (msg.includes("Not authorized")) return reply.status(403).send({ error: msg });
    if (msg.includes("offline")) return reply.status(409).send({ error: msg });
    return reply.status(500).send({ error: msg });
  }
}

// 4. Get recent access & delivery logs (with Today-guaranteed initial page & cursor pagination)
export async function getDeviceLogs(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const user = request.user as { id: string };
  const queryParams = (request.query as {
    todayStart?: string;
    before?: string;
    limit?: string;
  }) || {};

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

  const baseFilter = {
    $or: [{ deviceId: device._id }, { "metadata.deviceId": device.deviceId }],
    action: { $nin: ["door_open", "door_opened"] },
  };

  const limit = Math.min(50, Math.max(1, parseInt(queryParams.limit || "15", 10)));
  const { before, todayStart } = queryParams;

  let logs: any[] = [];
  let hasMore = false;

  if (before) {
    // Cursor-based pagination for older logs (Yesterday and earlier)
    const beforeDate = new Date(before);
    logs = await Log.find({
      ...baseFilter,
      timestamp: { $lt: beforeDate },
    })
      .sort({ timestamp: -1 })
      .limit(limit + 1)
      .lean();

    if (logs.length > limit) {
      hasMore = true;
      logs.pop(); // Remove probe item
    }
  } else {
    // Initial Load: Guarantee all of Today's activity + top up to limit with older logs if today < limit
    const todayDate = todayStart ? new Date(todayStart) : new Date(Date.now() - 24 * 60 * 60 * 1000);

    const todayLogs = await Log.find({
      ...baseFilter,
      timestamp: { $gte: todayDate },
    })
      .sort({ timestamp: -1 })
      .lean();

    if (todayLogs.length >= limit) {
      // If Today alone has >= limit items (e.g. 20, 25 items), return ALL of Today!
      logs = todayLogs;
      const olderCount = await Log.countDocuments({
        ...baseFilter,
        timestamp: { $lt: todayDate },
      });
      hasMore = olderCount > 0;
    } else {
      // If Today has fewer items, top up with older logs so initial view has at least 'limit' items
      const needed = limit - todayLogs.length;
      const olderLogs = await Log.find({
        ...baseFilter,
        timestamp: { $lt: todayDate },
      })
        .sort({ timestamp: -1 })
        .limit(needed + 1)
        .lean();

      if (olderLogs.length > needed) {
        hasMore = true;
        olderLogs.pop(); // Remove probe item
      }
      logs = [...todayLogs, ...olderLogs];
    }
  }

  const nextCursor = logs.length > 0 ? logs[logs.length - 1].timestamp : null;

  return reply.send({
    logs,
    hasMore,
    nextCursor,
    count: logs.length,
  });
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

  const isOwner = device.ownerId?.toString() === user.id || (device.ownerId as any)?._id?.toString() === user.id;
  if (!isOwner) {
    return reply.status(403).send({ error: "Only the primary owner can rename this locker box" });
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
      online: deviceStatusService.resolveDeviceOnline(device.deviceId, device.online, device.lastHeartbeat),
      doorState: device.doorState,
    },
  });
}


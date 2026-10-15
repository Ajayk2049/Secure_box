import { hashPassword } from "../utils/password.js";
import { FastifyRequest, FastifyReply } from "fastify";
import { Device } from "../models/Device.model.js";
import { User } from "../models/User.model.js";
import { Log } from "../models/Log.model.js";
import { smsService } from "../services/sms.service.js";
import { generateDeviceKey } from "./adminRequests.controller.js";

// 1. Create a customer manually from admin
export async function createCustomer(request: FastifyRequest, reply: FastifyReply) {
  const { phone, email, name, password } = (request.body as {
    phone?: string;
    email?: string;
    name?: string;
    password?: string;
  }) || {};

  if (!phone && !email) {
    return reply.status(400).send({ error: "Phone number or email is required" });
  }

  if (!password || password.trim().length < 6 || password.trim().length > 12) {
    return reply.status(400).send({ error: "Password is required and must be between 6 and 12 characters long" });
  }

  const cleanPhone = phone ? smsService.normalizePhone(phone) : undefined;
  if (cleanPhone) {
    const existing = await User.findOne({ phone: cleanPhone });
    if (existing) return reply.status(409).send({ error: "Customer with this phone already exists" });
  }

  const hashedPassword = await hashPassword(password.trim());

  const userData: any = {
    name: name?.trim() || "Customer",
    password: hashedPassword,
    role: "user",
    isPhoneVerified: true,
  };
  if (cleanPhone) userData.phone = cleanPhone;
  if (email && email.trim()) userData.email = email.toLowerCase().trim();

  const user = await User.create(userData);
  const userObj = user.toObject();
  delete (userObj as any).password;

  return reply.status(201).send({ success: true, user: userObj });
}

// 2. Get all devices with slot capacity calculations
export async function getAllDevices(request: FastifyRequest, reply: FastifyReply) {
  const devices = await Device.find()
    .populate("ownerId", "phone email name role")
    .populate("coOwners", "phone email name");

  const devicesWithSlotStats = devices.map((dev) => {
    const allowed = dev.allowedSlots || 2;
    const occupied = 1 + (dev.coOwners ? dev.coOwners.length : 0);
    return {
      ...dev.toObject(),
      totalCapacity: 5,
      allowedSlots: allowed,
      lockedSlots: 5 - allowed,
      occupiedSlots: occupied,
      availableSlots: Math.max(0, allowed - occupied),
    };
  });

  return reply.send({ devices: devicesWithSlotStats });
}

// 3. Get all non-admin users
export async function getAllUsers(request: FastifyRequest, reply: FastifyReply) {
  const users = await User.find({ role: { $ne: "admin" } }).select("-password");
  return reply.send({ users });
}

// 4. System statistics
export async function getSystemStats(request: FastifyRequest, reply: FastifyReply) {
  const totalDevices = await Device.countDocuments();
  const onlineDevices = await Device.countDocuments({ online: true });
  const totalUsers = await User.countDocuments({ role: { $ne: "admin" } });
  const totalLogs = await Log.countDocuments();

  return reply.send({
    stats: {
      totalDevices,
      onlineDevices,
      totalUsers,
      totalLogs,
    },
  });
}

// 5. Update device slot limits
export async function updateDeviceSlots(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const { allowedSlots } = request.body as { allowedSlots?: number };

  if (typeof allowedSlots !== "number" || allowedSlots < 2 || allowedSlots > 5) {
    return reply.status(400).send({
      error: "allowedSlots must be a number between 2 and 5 (default: 2, total capacity: 5)",
    });
  }

  const device = await Device.findById(id).populate("ownerId", "email");
  if (!device) {
    return reply.status(404).send({ error: "Device not found" });
  }

  const prevSlots = device.allowedSlots || 2;
  device.allowedSlots = allowedSlots;
  await device.save();

  await Log.create({
    deviceId: device._id,
    action: "unlock",
    metadata: {
      action: "admin_slot_update",
      previousAllowedSlots: prevSlots,
      newAllowedSlots: allowedSlots,
      updatedBy: (request.user as { id: string })?.id,
    },
  });

  return reply.send({
    success: true,
    message: `Device ${device.deviceId} slots successfully updated to ${allowedSlots} (Capacity: 5)`,
    device: {
      id: device._id,
      deviceId: device.deviceId,
      name: device.name,
      totalCapacity: 5,
      allowedSlots: device.allowedSlots,
      lockedSlots: 5 - device.allowedSlots,
      occupiedSlots: 1 + (device.coOwners ? device.coOwners.length : 0),
    },
  });
}

// 6. Create device for user
export async function createDeviceForUser(request: FastifyRequest, reply: FastifyReply) {
  const { deviceId, name, ownerId } = (request.body as {
    deviceId?: string;
    name?: string;
    ownerId?: string;
  }) || {};

  if (!deviceId || !name || !ownerId) {
    return reply.status(400).send({ error: "deviceId, name, and ownerId are required" });
  }

  const cleanDeviceId = deviceId.trim().toUpperCase();

  const existingDevice = await Device.findOne({ deviceId: cleanDeviceId });
  if (existingDevice) {
    return reply.status(409).send({ error: `Device ${cleanDeviceId} is already registered` });
  }

  const owner = await User.findById(ownerId);
  if (!owner) {
    return reply.status(404).send({ error: "Owner user not found" });
  }

  const device = await Device.create({
    deviceId: cleanDeviceId,
    name: name.trim(),
    ownerId: owner._id,
    coOwners: [],
    allowedSlots: 2,
    doorState: "closed",
    online: false,
    lastHeartbeat: null,
    deviceKey: generateDeviceKey(),
  });

  return reply.status(201).send({
    success: true,
    message: `Device ${cleanDeviceId} successfully assigned to ${owner.name || owner.email}`,
    device,
  });
}

// 7. Delete device
export async function deleteDevice(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const device = await Device.findByIdAndDelete(id);
  if (!device) {
    return reply.status(404).send({ error: "Device not found" });
  }
  await Log.deleteMany({ deviceId: device._id });
  return reply.send({ success: true, message: `Device ${device.deviceId} deleted successfully` });
}

// 8. System & Device Logs
export async function getSystemLogs(request: FastifyRequest, reply: FastifyReply) {
  const logs = await Log.find()
    .populate("deviceId", "deviceId name")
    .sort({ timestamp: -1 })
    .limit(200);

  return reply.send({ logs });
}

export async function getDeviceLogsForAdmin(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const logs = await Log.find({ deviceId: id })
    .sort({ timestamp: -1 })
    .limit(100);

  return reply.send({ logs });
}

// 9. Rotate device hardware key from Admin Dashboard
export async function rotateDeviceKey(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };

  const device = await Device.findById(id);
  if (!device) {
    return reply.status(404).send({ error: "Device not found" });
  }

  const newKey = generateDeviceKey();
  device.deviceKey = newKey;
  await device.save();

  await Log.create({
    deviceId: device._id,
    action: "unlock",
    status: "success",
    metadata: {
      action: "admin_key_rotation",
      rotatedBy: (request.user as { id: string })?.id,
    },
  });

  return reply.send({
    success: true,
    message: `Hardware key for device ${device.deviceId} rotated successfully`,
    deviceId: device.deviceId,
    deviceKey: newKey,
  });
}

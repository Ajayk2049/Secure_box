import { FastifyRequest, FastifyReply } from "fastify";
import mongoose from "mongoose";
import { Device } from "../models/Device.model.js";
import { User } from "../models/User.model.js";
import { Log } from "../models/Log.model.js";
import { commandQueueService } from "../services/commandQueue.service.js";
import { wsService } from "../services/websocket.service.js";
import { deviceSocketService } from "../services/deviceSocket.service.js";
import { deviceStatusService } from "../services/deviceStatus.service.js";
import { devicePresenceService } from "../services/devicePresence.service.js";
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
    const presence = deviceStatusService.getDevicePresence(d.deviceId, d.online, d.lastHeartbeat);
    return {
      ...obj,
      online: presence.online,
      statusVersion: presence.statusVersion,
      lastSeen: presence.lastSeenAt ? new Date(presence.lastSeenAt).toISOString() : null,
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

  const sanitizeLogs = (rawList: any[]) => {
    const result: any[] = [];
    for (let i = 0; i < rawList.length; i++) {
      const entry = rawList[i];
      const action = (entry.action || "").toString().toLowerCase();

      if (action === "door_open" || action === "door_opened") {
        const entryTime = new Date(entry.timestamp).getTime();
        const hasAdjacentAppUnlock = rawList.some((other) => {
          const otherAction = (other.action || "").toString().toLowerCase();
          if (!otherAction.includes("unlock") || otherAction.includes("emergency")) return false;
          const otherTime = new Date(other.timestamp).getTime();
          return Math.abs(otherTime - entryTime) <= 15000;
        });

        if (hasAdjacentAppUnlock) {
          continue;
        }

        result.push({
          ...entry,
          action: "emergency_unlock",
          metadata: {
            ...(entry.metadata || {}),
            event: "emergency_manual_unlock",
            source: "physical_latch",
            userName: entry.metadata?.userName || "Manual Latch / Lever",
            userRole: entry.metadata?.userRole || "Physical Access",
          },
        });
        continue;
      }

      result.push(entry);
    }
    return result;
  };

  const sanitized = sanitizeLogs(logs);
  const nextCursor = sanitized.length > 0 ? sanitized[sanitized.length - 1].timestamp : null;

  return reply.send({
    logs: sanitized,
    hasMore,
    nextCursor,
    count: sanitized.length,
  });
}

// 6. Phase 0 diagnostics: explain exactly which inputs produced the online status
export async function getDeviceStatusDebug(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const user = request.user as { id: string; role?: string };

  if (!id || !id.trim()) {
    return reply.status(400).send({ error: "Device id is required" });
  }

  const target = id.trim();
  let device: any = null;
  if (mongoose.Types.ObjectId.isValid(target)) {
    device = await Device.findById(target).select("-deviceKey -deviceKeyHash").lean();
  }
  if (!device) {
    device = await Device.findOne({ deviceId: target.toUpperCase() })
      .select("-deviceKey -deviceKeyHash")
      .lean();
  }

  if (!device) {
    return reply.status(404).send({ error: "Device not found" });
  }

  const isAdmin = user.role === "admin";
  if (!isAdmin && !isAuthorizedUser(device, user.id)) {
    return reply.status(403).send({ error: "Not authorized" });
  }

  // Phase 0: durable churn history. device_online is written on every hardware
  // (re)connect, so its count is a direct measure of socket churn; offline
  // entries are split by producer so the cause is attributable.
  const query = (request.query as { windowHours?: string }) || {};
  const parsedWindow = parseInt(query.windowHours || "24", 10);
  const windowHours = Number.isFinite(parsedWindow)
    ? Math.min(168, Math.max(1, parsedWindow))
    : 24;
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  const transitionLogs = await Log.find({
    $or: [{ deviceId: device._id }, { "metadata.deviceId": device.deviceId }],
    action: { $in: ["device_online", "device_offline"] },
    timestamp: { $gte: since },
  })
    .sort({ timestamp: -1 })
    .limit(2000)
    .select("action timestamp metadata.source")
    .lean();

  const counts = { online: 0, offlineSocket: 0, offlineWatchdog: 0, offlineOther: 0 };
  for (const entry of transitionLogs as any[]) {
    if (entry.action === "device_online") {
      counts.online += 1;
    } else {
      const source = entry.metadata?.source;
      if (source === "esp32_websocket_disconnect") counts.offlineSocket += 1;
      else if (source === "watchdog_timeout") counts.offlineWatchdog += 1;
      else counts.offlineOther += 1;
    }
  }

  return reply.send({
    status: deviceStatusService.buildStatusDebug(device),
    // Phase 1: process-wide presence authority state (tracked devices, timers,
    // publish counters). Read-only; never mutates presence.
    presence: devicePresenceService.getDiagnostics(),
    history: {
      windowHours,
      since: since.toISOString(),
      truncated: transitionLogs.length >= 2000,
      counts,
      // Hardware reconnects per hour. Baseline this before the fix, then compare.
      reconnectsPerHour: Number((counts.online / windowHours).toFixed(2)),
      recentTransitions: (transitionLogs as any[]).slice(0, 15).map((entry) => ({
        action: entry.action,
        at: entry.timestamp ? new Date(entry.timestamp).toISOString() : null,
        source: entry.metadata?.source ?? null,
      })),
    },
    requestedBy: { userId: user.id, role: user.role || "user" },
  });
}

// 7. Update Device / Box Name
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

  const presence = deviceStatusService.getDevicePresence(device.deviceId, device.online, device.lastHeartbeat);
  return reply.send({
    success: true,
    message: "Device renamed successfully",
    device: {
      id: device._id,
      deviceId: device.deviceId,
      name: device.name,
      online: presence.online,
      statusVersion: presence.statusVersion,
      lastSeen: presence.lastSeenAt ? new Date(presence.lastSeenAt).toISOString() : null,
      doorState: device.doorState,
    },
  });
}


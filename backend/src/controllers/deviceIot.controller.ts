import crypto from "crypto";
import { FastifyRequest, FastifyReply } from "fastify";
import { Device } from "../models/Device.model.js";
import { Log } from "../models/Log.model.js";
import { User } from "../models/User.model.js";
import { commandQueueService } from "../services/commandQueue.service.js";
import { wsService } from "../services/websocket.service.js";
import { deviceSocketService } from "../services/deviceSocket.service.js";
import { verifyDeviceKey, hashDeviceKey } from "../utils/crypto.js";
export { checkDeviceWatchdog } from "../services/deviceWatchdog.service.js";

export { testUnlockDevice } from "./testDiagnostics.controller.js";

async function findAndSelectDevice(targetId: string) {
  let device: any = await Device.findOne({ deviceId: targetId }).select("+deviceKeyHash +deviceKey");
  if (!device && process.env.NODE_ENV !== "production") {
    const escaped = targetId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    device = await Device.findOne({ deviceId: { $regex: new RegExp(`^${escaped}$`, "i") } }).select("+deviceKeyHash +deviceKey");
  }
  return device;
}

function isDeviceAuthorized(device: any, request: FastifyRequest): boolean {
  const providedKey = (request.headers["x-device-key"] as string | undefined)?.trim();
  if (process.env.NODE_ENV !== "production" && (process.env.DEMO_MODE === "true" || providedKey === "SIMULATOR_TEST_KEY")) {
    if (!device.deviceKeyHash && !device.deviceKey) {
      device.deviceKeyHash = hashDeviceKey(`sbx_live_${crypto.randomBytes(16).toString("hex")}`);
      device.save().catch(() => {});
    }
    return true;
  }
  if (!providedKey) return false;
  const authCheck = verifyDeviceKey(providedKey, device.deviceKeyHash, device.deviceKey);
  if (!authCheck.valid) return false;
  if (authCheck.needsMigration) {
    device.deviceKeyHash = hashDeviceKey(providedKey);
    device.deviceKey = undefined;
    device.save().catch(() => {});
  }
  return true;
}

// 2. Short-polling: GET /api/device/command?deviceId=BOX_001
export async function getDeviceCommand(request: FastifyRequest, reply: FastifyReply) {
  const query = request.query as { deviceId?: string };
  const headerDeviceId = request.headers["x-device-id"] as string | undefined;
  const targetId = (query.deviceId || headerDeviceId || "").trim().toUpperCase();
  if (!targetId) return reply.status(400).send({ error: "deviceId query parameter or x-device-id header is required" });

  const device = await findAndSelectDevice(targetId);
  if (!device) return reply.status(404).send({ error: `Device '${targetId}' not registered` });
  if (!isDeviceAuthorized(device, request)) return reply.status(401).send({ error: "Unauthorized: Invalid or missing X-Device-Key" });

  const wasOffline = !device.online;
  const now = Date.now();
  const lastHeartbeatTime = device.lastHeartbeat ? new Date(device.lastHeartbeat).getTime() : 0;
  // Throttle MongoDB writes: only save if status changed or >30 seconds elapsed
  if (wasOffline || now - lastHeartbeatTime > 30000) {
    device.online = true;
    device.lastHeartbeat = new Date(now);
    await device.save();
  }

  if (wasOffline) {
    const targets = [targetId, device._id, device.ownerId, ...(device.coOwners || [])];
    const doorStatus = device.doorState === "closed" ? "locked" : "unlocked";
    wsService.broadcastToDeviceGroup(targets, { type: "DEVICE_STATUS", deviceId: targetId, doorState: device.doorState, doorStatus, online: true });
    wsService.broadcastToDeviceGroup(targets, { type: "DEVICE_ONLINE", deviceId: targetId });
  }

  const pending = commandQueueService.popPendingCommand(targetId);
  if (pending) {
    return reply.send({
      action: pending.action,
      commandId: pending.commandId,
      timestamp: pending.enqueuedAt,
      doorState: device.doorState,
      doorStatus: device.doorState === "closed" ? "locked" : "unlocked",
    });
  }

  return reply.send({
    action: "none",
    doorState: device.doorState,
    doorStatus: device.doorState === "closed" ? "locked" : "unlocked",
  });
}

// 3. Telemetry: POST /api/device/telemetry
export async function receiveTelemetry(request: FastifyRequest, reply: FastifyReply) {
  const body = (request.body as Record<string, any>) || {};
  const headerDeviceId = request.headers["x-device-id"] as string | undefined;
  const targetId = (body.deviceId || headerDeviceId || "").trim().toUpperCase();

  // Flexible extraction of door state/status from any standard naming convention
  const rawStatus = (
    body.doorState ||
    body.doorStatus ||
    body.doorstatus ||
    body.door_state ||
    body.door_status ||
    body.state ||
    body.status ||
    ""
  )
    .toString()
    .trim()
    .toLowerCase();

  if (!targetId) {
    return reply.status(400).send({ error: "deviceId is required" });
  }

  // Normalize flexible status inputs:
  // "locked", "lock", "closed", "close", "shut" -> "closed"
  // "unlocked", "unlock", "open", "opened", "ajar" -> "open"
  let normalizedDoorState: "open" | "closed" | null = null;
  if (["closed", "close", "locked", "lock", "shut"].includes(rawStatus)) {
    normalizedDoorState = "closed";
  } else if (["open", "opened", "unlock", "unlocked", "ajar"].includes(rawStatus)) {
    normalizedDoorState = "open";
  }

  if (!normalizedDoorState) {
    return reply.status(400).send({
      error: "doorState or doorStatus must be 'closed'/'locked' or 'open'/'unlocked'",
      received: rawStatus || "(empty)",
    });
  }

  const device = await findAndSelectDevice(targetId);
  if (!device) return reply.status(404).send({ error: `Device '${targetId}' not registered` });
  if (!isDeviceAuthorized(device, request)) return reply.status(401).send({ error: "Unauthorized: Invalid or missing X-Device-Key" });

  device.doorState = normalizedDoorState;
  device.online = true;
  device.lastHeartbeat = new Date();
  await device.save();

  const doorStatus = normalizedDoorState === "closed" ? "locked" : "unlocked";

  const statusMsg = {
    type: "DEVICE_STATUS",
    deviceId: targetId,
    doorState: normalizedDoorState,
    doorStatus,
    online: true,
  };
  const targets = [targetId, device._id, device.ownerId, ...(device.coOwners || [])];
  wsService.broadcastToDeviceGroup(targets, statusMsg);

  if (normalizedDoorState === "closed") {
    await Log.create({
      deviceId: device._id,
      action: "lock",
      metadata: {
        event: "door_locked",
        source: "physical_sensor",
        userName: "Mechanical Latch",
        userRole: "Auto / Sensor",
        deviceId: device.deviceId,
      },
    });

    const deliveryMsg = {
      type: "DELIVERY_SUCCESS",
      deviceId: targetId,
      doorState: "closed",
      doorStatus: "locked",
      online: true,
    };
    wsService.broadcastToDeviceGroup(targets, deliveryMsg);
  } else {
    // Hardware door opened: check if this was triggered by an authorized app command
    const hasAuthorizedAppUnlock = commandQueueService.hasRecentUnlock(targetId);

    if (hasAuthorizedAppUnlock) {
      // Authorized app unlock already logged with user attribution; consume window
      commandQueueService.consumeRecentUnlock(targetId);
    } else {
      // Manual / Emergency unlock detected (key, lever, or state change during power restore)
      await Log.create({
        deviceId: device._id,
        action: "emergency_unlock",
        metadata: {
          event: "emergency_manual_unlock",
          source: "physical_sensor",
          userName: "Emergency Key / Lever",
          userRole: "Physical Access",
          deviceId: device.deviceId,
          detection: "hardware_feedback_trip",
        },
      });

      const emergencyMsg = {
        type: "EMERGENCY_UNLOCK",
        deviceId: targetId,
        doorState: "open",
        doorStatus: "unlocked",
        online: true,
      };
      wsService.broadcastToDeviceGroup(targets, emergencyMsg);
    }

    const openMsg = {
      type: "DOOR_OPEN",
      deviceId: targetId,
      doorState: "open",
      doorStatus: "unlocked",
      online: true,
    };
    wsService.broadcastToDeviceGroup(targets, openMsg);
  }

  return reply.send({
    success: true,
    deviceId: targetId,
    doorState: normalizedDoorState,
    doorStatus,
    online: true,
  });
}

// 4. Heartbeat: POST /api/device/heartbeat
export async function receiveHeartbeat(request: FastifyRequest, reply: FastifyReply) {
  const body = (request.body as { deviceId?: string }) || {};
  const headerDeviceId = request.headers["x-device-id"] as string | undefined;
  const targetId = (body.deviceId || headerDeviceId || "").trim().toUpperCase();

  if (!targetId) return reply.status(400).send({ error: "deviceId is required" });
  const device = await findAndSelectDevice(targetId);
  if (!device) return reply.status(404).send({ error: `Device '${targetId}' not registered` });
  if (!isDeviceAuthorized(device, request)) return reply.status(401).send({ error: "Unauthorized: Invalid or missing X-Device-Key" });

  device.online = true;
  device.lastHeartbeat = new Date();
  await device.save();

  const heartbeatMsg = {
    type: "DEVICE_STATUS",
    deviceId: targetId,
    doorState: device.doorState,
    online: true,
  };
  wsService.broadcastToDeviceGroup([targetId, device._id, device.ownerId], heartbeatMsg);

  return reply.send({ success: true, online: true, timestamp: device.lastHeartbeat });
}

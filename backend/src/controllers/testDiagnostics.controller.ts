import { FastifyRequest, FastifyReply } from "fastify";
import { Device } from "../models/Device.model.js";
import { Log } from "../models/Log.model.js";
import { commandQueueService } from "../services/commandQueue.service.js";
import { wsService } from "../services/websocket.service.js";
import { deviceSocketService } from "../services/deviceSocket.service.js";
import { generateDeviceKey, hashDeviceKey } from "../utils/crypto.js";

// Diagnostics endpoint for bench testing: POST /api/test/unlock
export async function testUnlockDevice(request: FastifyRequest, reply: FastifyReply) {
  const { deviceId } = request.body as { deviceId?: string };

  if (!deviceId) {
    return reply.status(400).send({ error: "deviceId is required in JSON body" });
  }

  const cleanDeviceId = deviceId.trim().toUpperCase();
  let device = await Device.findOne({ deviceId: cleanDeviceId });
  if (!device) {
    if (process.env.NODE_ENV !== "production") {
      const rawKey = generateDeviceKey();
      device = await Device.create({
        deviceId: cleanDeviceId,
        name: `Test Unit ${cleanDeviceId}`,
        doorState: "closed",
        online: true,
        deviceKeyHash: hashDeviceKey(rawKey),
      });
    } else {
      return reply.status(404).send({ error: `Device '${cleanDeviceId}' not found` });
    }
  }

  const enqueued = commandQueueService.enqueueCommand(cleanDeviceId, "unlock");
  const isDirectlyPushed = deviceSocketService.sendUnlockCommand(cleanDeviceId, enqueued.commandId, 3000);

  await Log.create({
    deviceId: device._id,
    action: "test_unlock_command",
    metadata: {
      source: isDirectlyPushed ? "test_endpoint_websocket_direct" : "test_endpoint",
      commandId: enqueued.commandId,
    },
  });

  wsService.broadcastToDevice(cleanDeviceId, {
    type: "UNLOCK_COMMAND",
    deviceId: cleanDeviceId,
    commandId: enqueued.commandId,
  });

  return reply.send({
    success: true,
    message: isDirectlyPushed
      ? `Bench unlock command dispatched in real-time to ${cleanDeviceId}`
      : `Bench unlock command enqueued for ${cleanDeviceId}`,
    commandId: enqueued.commandId,
    device: {
      deviceId: cleanDeviceId,
      name: device.name,
      online: device.online,
    },
  });
}

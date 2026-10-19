import { Device } from "../models/Device.model.js";
import { Log } from "../models/Log.model.js";
import { wsService } from "./websocket.service.js";
import { deviceSocketService } from "./deviceSocket.service.js";

/**
 * Background watchdog worker: marks devices offline when no heartbeat or WebSocket frame received.
 * Actively connected WebSocket devices are protected from being marked offline.
 */
export async function checkDeviceWatchdog(): Promise<void> {
  try {
    // 1. High-frequency in-memory ping sweep: reaps ghost sockets and terminates dead connections
    deviceSocketService.sweepConnections();

    // 2. Database safety sweep: catches any offline devices not covered by active sockets
    const threshold = new Date(Date.now() - 30 * 1000);
    const staleDevices = await Device.find({
      online: true,
      $or: [{ lastHeartbeat: { $lt: threshold } }, { lastHeartbeat: null }],
    });

    if (staleDevices.length === 0) return;

    const actuallyStale = [];

    for (const dev of staleDevices) {
      // Only protect if connection is genuinely fresh in RAM
      if (!deviceSocketService.isDeviceConnected(dev.deviceId)) {
        actuallyStale.push(dev);
      }
    }

    if (actuallyStale.length === 0) return;

    const now = new Date();
    for (const dev of actuallyStale) {
      // Atomic state transition: ONLY log if device is currently online (true -> false)
      const freshlyStale = await Device.findOneAndUpdate(
        { _id: dev._id, online: true },
        { $set: { online: false, lastDisconnectedAt: now } },
        { new: false }
      );

      if (freshlyStale) {
        await Log.create({
          deviceId: dev._id,
          action: "device_offline",
          timestamp: now,
          metadata: { source: "watchdog_timeout", reason: "heartbeat_timeout", deviceId: dev.deviceId },
        }).catch((err) => console.error("Error creating watchdog offline log:", err));

        const offlineMsg = {
          type: "DEVICE_STATUS",
          deviceId: dev.deviceId,
          online: false,
          doorState: dev.doorState,
        };
        wsService.broadcastToDeviceGroup([dev.deviceId, dev._id, dev.ownerId], offlineMsg);
      }
    }
  } catch (err) {
    console.error("Error in device watchdog:", err);
  }
}

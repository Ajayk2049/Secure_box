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
    const threshold = new Date(Date.now() - 45 * 1000);
    const staleDevices = await Device.find({
      online: true,
      $or: [{ lastHeartbeat: { $lt: threshold } }, { lastHeartbeat: null }],
    });

    if (staleDevices.length === 0) return;

    const actuallyStale = [];

    for (const dev of staleDevices) {
      // If the hardware WebSocket is currently active and open, protect it
      if (deviceSocketService.isDeviceConnected(dev.deviceId)) {
        await Device.updateOne(
          { _id: dev._id },
          { $set: { lastHeartbeat: new Date(), online: true } }
        ).catch(() => {});
      } else {
        actuallyStale.push(dev);
      }
    }

    if (actuallyStale.length === 0) return;

    // Atomically batch update all truly stale devices to offline
    const now = new Date();
    const staleIds = actuallyStale.map((d) => d._id);
    await Device.updateMany({ _id: { $in: staleIds } }, { $set: { online: false, lastDisconnectedAt: now } });

    // Record persistent activity audit logs
    const logDocs = actuallyStale.map((dev) => ({
      deviceId: dev._id,
      action: "device_offline",
      timestamp: now,
      metadata: { source: "watchdog_timeout", reason: "heartbeat_timeout", deviceId: dev.deviceId },
    }));
    await Log.insertMany(logDocs).catch((err) => console.error("Error creating watchdog offline logs:", err));

    for (const dev of actuallyStale) {
      const offlineMsg = {
        type: "DEVICE_STATUS",
        deviceId: dev.deviceId,
        online: false,
        doorState: dev.doorState,
      };
      wsService.broadcastToDeviceGroup([dev.deviceId, dev._id, dev.ownerId], offlineMsg);
    }
  } catch (err) {
    console.error("Error in device watchdog:", err);
  }
}

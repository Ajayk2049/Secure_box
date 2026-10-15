import { Device } from "../models/Device.model.js";
import { wsService } from "./websocket.service.js";

/**
 * Background watchdog worker: marks devices offline when no heartbeat or WebSocket frame received.
 */
export async function checkDeviceWatchdog(): Promise<void> {
  try {
    const threshold = new Date(Date.now() - 30 * 1000);
    const staleDevices = await Device.find({
      online: true,
      $or: [{ lastHeartbeat: { $lt: threshold } }, { lastHeartbeat: null }],
    });

    if (staleDevices.length === 0) return;

    // Atomically batch update all stale devices to offline
    const staleIds = staleDevices.map((d) => d._id);
    await Device.updateMany({ _id: { $in: staleIds } }, { $set: { online: false } });

    for (const dev of staleDevices) {
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

import { Device } from "../models/Device.model.js";
import { Log } from "../models/Log.model.js";
import { wsService } from "./websocket.service.js";
import { deviceSocketService, getGhostTimeoutMs } from "./deviceSocket.service.js";
import { deviceNotificationService } from "./deviceNotification.service.js";

function dbHeartbeatAgeMs(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  if (!Number.isFinite(ms)) return null;
  return Date.now() - ms;
}

/**
 * Background watchdog worker: marks devices offline when no heartbeat or WebSocket frame received.
 * Actively connected WebSocket devices are protected from being marked offline.
 */
export async function checkDeviceWatchdog(): Promise<void> {
  try {
    // 1. High-frequency in-memory ping sweep: reaps ghost sockets and terminates dead connections
    deviceSocketService.sweepConnections();

    // 2. Database safety sweep: catches any offline devices not covered by active sockets
    const ghostCutoffMs = getGhostTimeoutMs();
    const threshold = new Date(Date.now() - ghostCutoffMs);
    const staleDevices = await Device.find({
      online: true,
      $or: [{ lastHeartbeat: { $lt: threshold } }, { lastHeartbeat: null }],
    });

    if (staleDevices.length === 0) return;

    const actuallyStale = [];

    for (const dev of staleDevices) {
      // Only protect if connection is genuinely fresh in RAM
      const protectedBySocket = deviceSocketService.isDeviceConnected(dev.deviceId);
      if (protectedBySocket) {
        const snap = deviceSocketService.getConnectionSnapshot(dev.deviceId);
        console.log(
          `[DEVICE-STATUS-TRACE] at=${new Date().toISOString()} watchdog_protect device=${dev.deviceId} ` +
            `dbOnline=true dbHeartbeatAgeMs=${dbHeartbeatAgeMs(dev.lastHeartbeat)} cutoffMs=${ghostCutoffMs} ` +
            `socketTracked=${snap.tracked} socketState=${snap.state} socketAgeMs=${snap.lastActivityAgeMs} ` +
            `socketFresh=${snap.isFresh} missedPings=${snap.missedPings} decision=KEEP_ONLINE reason=socket_fresh`
        );
      } else {
        const snap = deviceSocketService.getConnectionSnapshot(dev.deviceId);
        console.log(
          `[DEVICE-STATUS-TRACE] at=${new Date().toISOString()} watchdog_demote device=${dev.deviceId} ` +
            `dbOnline=true dbHeartbeatAgeMs=${dbHeartbeatAgeMs(dev.lastHeartbeat)} cutoffMs=${ghostCutoffMs} ` +
            `socketTracked=${snap.tracked} socketState=${snap.state} socketAgeMs=${snap.lastActivityAgeMs} ` +
            `socketFresh=${snap.isFresh} missedPings=${snap.missedPings} decision=MARK_OFFLINE reason=no_fresh_socket`
        );
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
        console.log(
          `[DEVICE-STATUS-TRACE] at=${new Date().toISOString()} watchdog_applied device=${dev.deviceId} transition=ONLINE_TO_OFFLINE source=watchdog_timeout`
        );
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
        deviceNotificationService.scheduleOfflineNotification(dev);
      }
    }
  } catch (err) {
    console.error("Error in device watchdog:", err);
  }
}

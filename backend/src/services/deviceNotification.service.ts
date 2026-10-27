import { Device, IDevice } from "../models/Device.model.js";
import { fcmService } from "./fcm.service.js";
import { config } from "../config.js";

/**
 * DeviceNotificationService manages push notification delivery for hardware devices
 * with a configurable grace period to prevent notification flapping and spam
 * caused by transient network glitches, socket re-handshakes, or relay actuation.
 */
class DeviceNotificationService {
  private pendingOfflineTimers: Map<string, NodeJS.Timeout> = new Map();
  private notifiedOfflineDevices: Set<string> = new Set();

  /**
   * Schedules an offline push notification after the grace period.
   * If the device reconnects before the grace period expires, the notification is cancelled.
   */
  scheduleOfflineNotification(device: IDevice | any): void {
    const rawId = device?.deviceId || "";
    const cleanId = String(rawId).trim().toUpperCase();
    if (!cleanId) return;

    // If an offline alert timer is already actively counting down for this device, do not duplicate
    if (this.pendingOfflineTimers.has(cleanId)) {
      return;
    }

    // If the user was already notified that this device is offline, do not schedule another
    if (this.notifiedOfflineDevices.has(cleanId)) {
      return;
    }

    const graceSec = config.deviceOfflineGracePeriodSec || 60;
    const graceMs = graceSec * 1000;

    const timer = setTimeout(async () => {
      this.pendingOfflineTimers.delete(cleanId);

      try {
        // Query fresh device record from MongoDB to verify continuous offline status
        const currentDev = await Device.findOne({ deviceId: cleanId });
        if (currentDev && currentDev.online === false) {
          this.notifiedOfflineDevices.add(cleanId);
          console.log(`[FCM-GRACE] Device ${cleanId} remained offline for ${graceSec}s. Dispatching offline push notification.`);
          await fcmService.notifyDeviceOffline(currentDev);
        } else {
          console.log(`[FCM-GRACE] Device ${cleanId} is online in database. Suppressed offline notification.`);
        }
      } catch (err) {
        console.error(`[FCM-GRACE] Error verifying device status for delayed offline notice (${cleanId}):`, err);
      }
    }, graceMs);

    this.pendingOfflineTimers.set(cleanId, timer);
    console.log(`[FCM-GRACE] Device ${cleanId} disconnected. Scheduled offline notice in ${graceSec}s grace period.`);
  }

  /**
   * Handles device reconnection.
   * Cancels any pending offline notification timer.
   * Only delivers an online push notification if an offline alert was previously dispatched to the user.
   */
  async handleDeviceOnline(device: IDevice | any): Promise<void> {
    const rawId = device?.deviceId || "";
    const cleanId = String(rawId).trim().toUpperCase();
    if (!cleanId) return;

    // 1. Cancel pending offline notification timer if device reconnected within grace period
    const pendingTimer = this.pendingOfflineTimers.get(cleanId);
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      this.pendingOfflineTimers.delete(cleanId);
      console.log(`[FCM-GRACE] Device ${cleanId} reconnected within grace period. Cancelled pending offline alert.`);
    }

    // 2. Deliver "Device Online" notification ONLY if the user was previously alerted that it was offline
    if (this.notifiedOfflineDevices.has(cleanId)) {
      this.notifiedOfflineDevices.delete(cleanId);
      console.log(`[FCM-GRACE] Device ${cleanId} recovered from confirmed outage. Dispatching online push notification.`);
      await fcmService.notifyDeviceOnline(device).catch((e) => {
        console.error(`[FCM-GRACE] Error sending online notice for ${cleanId}:`, e);
      });
    } else {
      console.log(`[FCM-GRACE] Device ${cleanId} connected. Suppressed online notification (no prior offline alert delivered).`);
    }
  }

  /**
   * Checks whether an offline alert is currently pending for a given device.
   */
  isOfflineAlertPending(deviceId: string): boolean {
    const cleanId = String(deviceId).trim().toUpperCase();
    return this.pendingOfflineTimers.has(cleanId);
  }

  /**
   * Clears all active timers during shutdown.
   */
  clearAllTimers(): void {
    for (const timer of this.pendingOfflineTimers.values()) {
      clearTimeout(timer);
    }
    this.pendingOfflineTimers.clear();
    this.notifiedOfflineDevices.clear();
  }
}

export const deviceNotificationService = new DeviceNotificationService();

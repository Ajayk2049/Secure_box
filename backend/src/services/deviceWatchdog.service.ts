import { Device } from "../models/Device.model.js";
import { deviceSocketService } from "./deviceSocket.service.js";
import { devicePresenceService } from "./devicePresence.service.js";
import { config } from "../config.js";

/** Documented single decision path, kept in the log so incidents are traceable. */
const DECISION_OWNER = "devicePresenceService";

/**
 * Background watchdog worker.
 *
 * Phase 1: this function no longer decides whether a device is online. It has
 * exactly two jobs:
 *
 *   1. Socket hygiene — reap ghost sockets (RAM only, never user-visible).
 *   2. DB catch-up — for devices that have no RAM record (e.g. the process
 *      restarted, or a device never connected since boot), the DB projection is
 *      the only evidence available. Those are handed to the presence authority,
 *      which applies the same `restartFallbackSec` window used by reads, so a
 *      poll and the watchdog can never disagree.
 *
 * The former "mark offline using a stale DB timestamp while only validating a
 * 15 s RAM window" path is gone: that was defect (B), the source of the false
 * offline pushes.
 */
export async function checkDeviceWatchdog(): Promise<void> {
  try {
    // 1. RAM sweep: terminate silent sockets. Deliberately does not publish.
    deviceSocketService.sweepConnections();

    // 2. Defensive reconcile of every tracked device (timers are primary).
    await devicePresenceService.reconcileTracked();

    // 3. DB catch-up for devices with no RAM record at all.
    const fallbackWindowMs = config.deviceRestartFallbackSec * 1000;
    const cutoff = new Date(Date.now() - fallbackWindowMs);

    const staleDevices = await Device.find(
      {
        online: true,
        $or: [{ lastHeartbeat: { $lt: cutoff } }, { lastHeartbeat: null }],
      },
      { deviceId: 1 }
    )
      .lean()
      .catch(() => []);

    for (const stale of staleDevices) {
      const cleanId = String(stale?.deviceId || "").trim().toUpperCase();
      if (!cleanId) continue;

      // If it is tracked in RAM, the authority already has better evidence.
      if (devicePresenceService.peek(cleanId)) continue;

      // Seeds the record from this stale row; publishes only if the record ends
      // up confirmed offline, so a device that reconnected in between is safe.
      console.log(
        `[WATCHDOG-TRACE] at=${new Date().toISOString()} db_catchup device=${cleanId} ` +
          `decisionOwner=${DECISION_OWNER} fallbackWindowMs=${fallbackWindowMs}`
      );
      await devicePresenceService.confirmOffline(cleanId, "watchdog_timeout");
    }
  } catch (err) {
    console.error("[WATCHDOG] Presence reconcile failed:", err);
  }
}

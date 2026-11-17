/**
 * Phase 1 — the single source of truth for device presence.
 *
 * Ownership rules enforced by this module:
 *   1. Only this service may write `Device.online = false` and may emit
 *      `DEVICE_OFFLINE` / `online:false`.
 *   2. `DEVICE_ONLINE` is only emitted on a real `offline -> online` transition.
 *      The hardware may reconnect every 20 minutes; that is not user-visible.
 *   3. Reads (REST poll, admin tables, unlock gate, live stats) resolve through
 *      `getPresence()`, so the push and the poll can never disagree.
 *
 * Timing model: decisions use a monotonic clock (`performance.now()`), DB and
 * display use `Date`. Heartbeats never touch MongoDB; a 60 s batched flusher
 * projects online devices instead (see `flush()`).
 */
import { performance } from "node:perf_hooks";
import mongoose from "mongoose";
import { Device } from "../models/Device.model.js";
import { Log } from "../models/Log.model.js";
import { wsService } from "./websocket.service.js";
import { deviceNotificationService } from "./deviceNotification.service.js";
import { config } from "../config.js";
import {
  nextPresenceState,
  msUntilConfirmedOffline,
  isPresenceVisibleOnline,
  type PresenceState,
  type PresenceTiming,
} from "./devicePresence.state.js";

export type PresenceSource = "ram" | "db_fallback" | "untracked";

/** Who asked for the transition. Kept compatible with Phase 0 log sources. */
export type PresenceOrigin =
  | "esp32_websocket"
  | "esp32_websocket_disconnect"
  | "watchdog_timeout";

export interface PresenceView {
  state: PresenceState;
  /** The single source of truth: false only when confirmed offline. */
  online: boolean;
  lastSeenAgeMs: number | null;
  source: PresenceSource;
  /** Milliseconds until a `suspect` device is confirmed offline. */
  confirmInMs: number | null;
  socketOpen: boolean;
}

export interface PresencePeek {
  state: PresenceState;
  publishedOnline: boolean;
  socketOpen: boolean;
  lastSeenAgeMs: number | null;
  lastSeenAt: string;
}

interface PresenceRecord {
  state: PresenceState;
  /** What the outside world was last told. Drives every publish decision. */
  publishedOnline: boolean;
  socketOpen: boolean;
  lastSeenMonotonicMs: number;
  lastSeenAt: Date;
  confirmTimer: NodeJS.Timeout | null;
  lastOrigin: PresenceOrigin | null;
}

const FLUSH_CHUNK_SIZE = 500;

function normalizeDeviceId(deviceId: string | null | undefined): string {
  return String(deviceId ?? "").trim().toUpperCase();
}

function nowMonotonic(): number {
  return performance.now();
}

class DevicePresenceService {
  private records = new Map<string, PresenceRecord>();
  /** Per-device serialization: presence mutations are never interleaved. */
  private queues = new Map<string, Promise<void>>();
  private flusher: NodeJS.Timeout | null = null;
  private mongoDownWarned = false;

  private stats = {
    frames: 0,
    silentRecoveries: 0,
    offlineConfirmed: 0,
    onlinePublished: 0,
    onlineSuppressed: 0,
    flushes: 0,
    flushFailures: 0,
    publishFailures: 0,
  };

  private get timing(): PresenceTiming {
    return {
      suspectMs: config.devicePresenceSuspectSec * 1000,
      offlineMs: config.devicePresenceOfflineSec * 1000,
    };
  }

  // ---------------------------------------------------------------------------
  // Inputs
  // ---------------------------------------------------------------------------

  /** Proof of life: any frame (heartbeat, telemetry, door event, ping, pong). */
  async noteFrame(
    deviceId: string,
    deviceDoc?: any,
    origin: PresenceOrigin = "esp32_websocket"
  ): Promise<void> {
    const cleanId = normalizeDeviceId(deviceId);
    if (!cleanId) return;

    const record = await this.ensureRecord(cleanId, deviceDoc);
    record.lastSeenMonotonicMs = nowMonotonic();
    record.lastSeenAt = new Date();
    record.socketOpen = true;
    this.stats.frames += 1;

    await this.reconcile(cleanId, origin, deviceDoc);
  }

  /** A hardware socket was registered (including reconnects and replacements). */
  async noteSocketOpen(deviceId: string, deviceDoc?: any): Promise<void> {
    await this.noteFrame(deviceId, deviceDoc, "esp32_websocket");
  }

  /**
   * A hardware socket closed. This deliberately does NOT change the reported
   * state: silence decides. A reconnect inside the confirmation window is
   * therefore completely invisible to users.
   */
  async noteSocketClosed(deviceId: string): Promise<void> {
    const cleanId = normalizeDeviceId(deviceId);
    if (!cleanId) return;
    const record = this.records.get(cleanId);
    if (!record) return;
    record.socketOpen = false;
    await this.reconcile(cleanId, "esp32_websocket_disconnect");
  }

  // ---------------------------------------------------------------------------
  // Reads — the only public way to ask "is this device online?"
  // ---------------------------------------------------------------------------

  getPresence(
    deviceId: string,
    dbOnline?: boolean,
    dbLastHeartbeat?: Date | string | null
  ): PresenceView {
    const cleanId = normalizeDeviceId(deviceId);

    if (cleanId) {
      const record = this.records.get(cleanId);
      if (record) {
        const ageMs = this.ageOf(record);
        const state = nextPresenceState(
          { previous: record.state, socketOpen: record.socketOpen, lastSeenAgeMs: ageMs },
          this.timing
        );
        const online = isPresenceVisibleOnline(state);
        return {
          state,
          online,
          lastSeenAgeMs: Number.isFinite(ageMs) ? ageMs : null,
          source: "ram",
          confirmInMs: online ? msUntilConfirmedOffline(ageMs, this.timing) : null,
          socketOpen: record.socketOpen,
        };
      }
    }

    // Untracked (never connected since boot, or predating a restart): the only
    // evidence is the DB projection, which is trusted for one restart window.
    const dbAgeMs = this.dbAgeMs(dbLastHeartbeat);
    const trustedWindowMs = config.deviceRestartFallbackSec * 1000;
    const trusted =
      dbOnline === true && dbAgeMs !== null && dbAgeMs >= 0 && dbAgeMs < trustedWindowMs;
    const hasDbEvidence = typeof dbOnline === "boolean" || dbAgeMs !== null;

    return {
      state: trusted ? "online" : "offline",
      online: trusted,
      lastSeenAgeMs: dbAgeMs,
      source: hasDbEvidence ? "db_fallback" : "untracked",
      confirmInMs: null,
      socketOpen: false,
    };
  }

  /** Synchronous, no-IO view used by diagnostics. Returns null when untracked. */
  peek(deviceId: string): PresencePeek | null {
    const cleanId = normalizeDeviceId(deviceId);
    const record = cleanId ? this.records.get(cleanId) : undefined;
    if (!record) return null;
    const ageMs = this.ageOf(record);
    // Live-computed so diagnostics never report a stale stored state.
    const state = nextPresenceState(
      { previous: record.state, socketOpen: record.socketOpen, lastSeenAgeMs: ageMs },
      this.timing
    );
    return {
      state,
      publishedOnline: record.publishedOnline,
      socketOpen: record.socketOpen,
      lastSeenAgeMs: Number.isFinite(ageMs) ? ageMs : null,
      lastSeenAt: record.lastSeenAt.toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // Reconciliation
  // ---------------------------------------------------------------------------

  private reconcile(
    cleanId: string,
    origin: PresenceOrigin,
    deviceDoc?: any
  ): Promise<void> {
    const previous = this.queues.get(cleanId) ?? Promise.resolve();
    const next = previous
      .then(() => this.reconcileNow(cleanId, origin, deviceDoc))
      .catch((err) => {
        console.error(`[PRESENCE] reconcile failed for ${cleanId}:`, err);
      });

    this.queues.set(cleanId, next);
    void next.finally(() => {
      if (this.queues.get(cleanId) === next) this.queues.delete(cleanId);
    });
    return next;
  }

  private async reconcileNow(
    cleanId: string,
    origin: PresenceOrigin,
    deviceDoc?: any
  ): Promise<void> {
    const record = this.records.get(cleanId);
    if (!record) return;

    const ageMs = this.ageOf(record);
    const previousState = record.state;
    const nextState = nextPresenceState(
      { previous: previousState, socketOpen: record.socketOpen, lastSeenAgeMs: ageMs },
      this.timing
    );
    record.state = nextState;
    record.lastOrigin = origin;

    if (nextState === "offline") {
      if (record.publishedOnline) {
        await this.publishOffline(cleanId, origin, ageMs, deviceDoc);
      }
    } else if (!record.publishedOnline) {
      await this.publishOnline(cleanId, origin, deviceDoc);
    } else if (previousState === "suspect" && nextState === "online") {
      // Silent recovery: frames resumed before anyone was told it was offline.
      this.stats.silentRecoveries += 1;
      deviceNotificationService.cancelPendingOfflineAlert(cleanId);
      console.log(
        `[PRESENCE-TRACE] at=${new Date().toISOString()} silent_recovery device=${cleanId} ` +
          `silenceMs=${Math.round(ageMs)} published=online_noop`
      );
    }

    this.armConfirmTimer(cleanId);
  }

  /**
   * Sweep every RAM record that lost its confirmation timer (defensive; the
   * timers are the primary mechanism). Called by the watchdog.
   */
  async reconcileTracked(origin: PresenceOrigin = "watchdog_timeout"): Promise<void> {
    for (const [cleanId, record] of this.records) {
      if (record.confirmTimer) continue;
      await this.reconcile(cleanId, origin);
    }
  }

  /**
   * Force the offline pipeline for a device that only exists in the DB
   * (e.g. after a restart). Publishes only if the world believes it is online.
   */
  async confirmOffline(deviceId: string, origin: PresenceOrigin): Promise<boolean> {
    const cleanId = normalizeDeviceId(deviceId);
    if (!cleanId) return false;
    await this.ensureRecord(cleanId);
    await this.reconcile(cleanId, origin);
    return this.records.get(cleanId)?.state === "offline";
  }

  private armConfirmTimer(cleanId: string): void {
    const record = this.records.get(cleanId);
    if (!record) return;
    if (record.confirmTimer) return; // already counting down to the same deadline
    if (record.state === "offline") return;

    const delayMs = msUntilConfirmedOffline(this.ageOf(record), this.timing) + 50;
    const timer = setTimeout(() => {
      record.confirmTimer = null;
      void this.reconcile(cleanId, "watchdog_timeout");
    }, Math.max(0, delayMs));

    if (typeof timer.unref === "function") timer.unref();
    record.confirmTimer = timer;
  }

  // ---------------------------------------------------------------------------
  // The only two publishing pipelines
  // ---------------------------------------------------------------------------

  private async publishOffline(
    cleanId: string,
    origin: PresenceOrigin,
    silenceMs: number,
    deviceDoc?: any
  ): Promise<void> {
    const record = this.records.get(cleanId);
    if (!record) return;
    record.publishedOnline = false;
    this.stats.offlineConfirmed += 1;

    const now = new Date();
    const roundedSilenceMs = Number.isFinite(silenceMs) ? Math.round(silenceMs) : null;

    let device: any = deviceDoc ?? null;
    let flipped = false;

    if (mongoose.connection.readyState === 1) {
      try {
        const updated = await Device.findOneAndUpdate(
          { deviceId: cleanId, online: true },
          { $set: { online: false, lastDisconnectedAt: now } }
        )
          .lean()
          .exec();
        if (updated) {
          device = updated;
          flipped = true;
        } else if (!device) {
          device = await Device.findOne({ deviceId: cleanId }).lean();
        }
      } catch (err) {
        this.stats.publishFailures += 1;
        console.error(`[PRESENCE] Failed to project offline state for ${cleanId}:`, err);
      }
    }

    console.log(
      `[PRESENCE-TRACE] at=${now.toISOString()} confirm_offline device=${cleanId} origin=${origin} ` +
        `silenceMs=${roundedSilenceMs ?? "null"} db_flipped=${flipped}`
    );

    if (!device) return;

    await Log.create({
      deviceId: device._id,
      action: "device_offline",
      timestamp: now,
      metadata: {
        source: origin,
        confirmedBy: "presence_hysteresis",
        silenceMs: roundedSilenceMs,
        deviceId: cleanId,
      },
    }).catch((err) => console.error(`[PRESENCE] Failed to log device_offline for ${cleanId}:`, err));

    const targets = [cleanId, device._id, device.ownerId, ...(device.coOwners || [])];
    wsService.broadcastToDeviceGroup(targets, {
      type: "DEVICE_OFFLINE",
      deviceId: cleanId,
      timestamp: now.toISOString(),
    });
    wsService.broadcastToDeviceGroup(targets, {
      type: "DEVICE_STATUS",
      deviceId: cleanId,
      online: false,
      doorState: device.doorState,
    });

    deviceNotificationService.scheduleOfflineNotification(device);
  }

  private async publishOnline(
    cleanId: string,
    origin: PresenceOrigin,
    deviceDoc?: any
  ): Promise<void> {
    const record = this.records.get(cleanId);
    if (!record || record.publishedOnline) {
      this.stats.onlineSuppressed += 1;
      return;
    }
    record.publishedOnline = true;
    this.stats.onlinePublished += 1;

    const now = new Date();
    let device: any = deviceDoc ?? null;
    if (!device && mongoose.connection.readyState === 1) {
      device = await Device.findOne({ deviceId: cleanId })
        .lean()
        .catch(() => null);
    }

    if (!device) {
      console.log(
        `[PRESENCE-TRACE] at=${now.toISOString()} publish_online device=${cleanId} origin=${origin} db_doc=missing`
      );
      return;
    }

    // Cancels a pending offline push; re-sends the online push only if the user
    // was actually told the device went offline.
    await deviceNotificationService.handleDeviceOnline(device);

    if (mongoose.connection.readyState === 1) {
      await Device.updateOne(
        { deviceId: cleanId },
        { $set: { online: true, lastConnectedAt: now, lastHeartbeat: now } }
      ).catch((err) => {
        this.stats.publishFailures += 1;
        console.error(`[PRESENCE] Failed to project online state for ${cleanId}:`, err);
      });
    }

    await Log.create({
      deviceId: device._id,
      action: "device_online",
      timestamp: now,
      metadata: { source: origin, deviceId: cleanId, confirmedBy: "presence_hysteresis" },
    }).catch((err) => console.error(`[PRESENCE] Failed to log device_online for ${cleanId}:`, err));

    const targets = [cleanId, device._id, device.ownerId, ...(device.coOwners || [])];
    wsService.broadcastToDeviceGroup(targets, {
      type: "DEVICE_ONLINE",
      deviceId: cleanId,
      timestamp: now.toISOString(),
    });
    wsService.broadcastToDeviceGroup(targets, {
      type: "DEVICE_STATUS",
      deviceId: cleanId,
      doorState: device.doorState,
      doorStatus: device.doorState === "closed" ? "locked" : "unlocked",
      online: true,
    });

    console.log(
      `[PRESENCE-TRACE] at=${now.toISOString()} confirm_online device=${cleanId} origin=${origin} transition=OFFLINE_TO_ONLINE`
    );
  }

  // ---------------------------------------------------------------------------
  // Batched DB projection (write budget)
  // ---------------------------------------------------------------------------

  startFlusher(): void {
    if (this.flusher) return;
    const intervalMs = config.deviceHeartbeatPersistSec * 1000;
    this.flusher = setInterval(() => {
      void this.flush();
    }, intervalMs);
    if (typeof this.flusher.unref === "function") this.flusher.unref();
    console.log(
      `[PRESENCE] Presence flusher active (every ${config.deviceHeartbeatPersistSec}s, ` +
        `suspect=${config.devicePresenceSuspectSec}s offline=${config.devicePresenceOfflineSec}s).`
    );
  }

  stopFlusher(): void {
    if (!this.flusher) return;
    clearInterval(this.flusher);
    this.flusher = null;
  }

  /** Projects the RAM truth into `Device.online` / `lastHeartbeat`. */
  async flush(): Promise<void> {
    const deviceIds: string[] = [];
    for (const [cleanId, record] of this.records) {
      // Only confirmed-alive devices are projected. Writing a fresh heartbeat
      // for a `suspect` device would make the DB claim liveness it does not have.
      if (record.publishedOnline && record.state === "online") deviceIds.push(cleanId);
    }
    if (deviceIds.length === 0) return;

    if (mongoose.connection.readyState !== 1) {
      if (!this.mongoDownWarned) {
        this.mongoDownWarned = true;
        console.warn("[PRESENCE] Skipping presence flush: MongoDB is not connected.");
      }
      return;
    }
    this.mongoDownWarned = false;

    const now = new Date();
    for (let i = 0; i < deviceIds.length; i += FLUSH_CHUNK_SIZE) {
      const chunk = deviceIds.slice(i, i + FLUSH_CHUNK_SIZE);
      try {
        // `online: true` guard: a flush must never resurrect a device that was
        // confirmed offline between snapshot and write.
        await Device.updateMany(
          { deviceId: { $in: chunk }, online: true },
          { $set: { online: true, lastHeartbeat: now } }
        );
      } catch (err) {
        this.stats.flushFailures += 1;
        console.error("[PRESENCE] Presence flush chunk failed:", err);
      }
    }
    this.stats.flushes += 1;
  }

  // ---------------------------------------------------------------------------
  // Diagnostics
  // ---------------------------------------------------------------------------

  getDiagnostics() {
    let online = 0;
    let suspect = 0;
    let offline = 0;
    for (const record of this.records.values()) {
      // Live-computed state (see peek()).
      const state = nextPresenceState(
        {
          previous: record.state,
          socketOpen: record.socketOpen,
          lastSeenAgeMs: this.ageOf(record),
        },
        this.timing
      );
      if (!record.publishedOnline) offline += 1;
      else if (state === "suspect") suspect += 1;
      else online += 1;
    }

    return {
      config: {
        suspectMs: this.timing.suspectMs,
        offlineMs: this.timing.offlineMs,
        persistMs: config.deviceHeartbeatPersistSec * 1000,
        restartFallbackMs: config.deviceRestartFallbackSec * 1000,
        ghostTimeoutMs: config.deviceGhostTimeoutSec * 1000,
        offlineGraceMs: config.deviceOfflineGracePeriodSec * 1000,
      },
      tracked: this.records.size,
      online,
      suspect,
      offline,
      flusherActive: Boolean(this.flusher),
      stats: { ...this.stats },
    };
  }

  /** Test/diagnostic helper: wipe RAM state. Never used in production paths. */
  clearForTests(): void {
    for (const record of this.records.values()) {
      if (record.confirmTimer) clearTimeout(record.confirmTimer);
    }
    this.records.clear();
    this.queues.clear();
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private async ensureRecord(cleanId: string, deviceDoc?: any): Promise<PresenceRecord> {
    const existing = this.records.get(cleanId);
    if (existing) return existing;

    let doc: any = deviceDoc ?? null;
    if (!doc && mongoose.connection.readyState === 1) {
      doc = await Device.findOne({ deviceId: cleanId })
        .lean()
        .catch(() => null);
    }

    // Seed from whichever value the outside world currently sees, so the first
    // reconcile only publishes a change that users had not already been told.
    const dbOnline = doc?.online === true;
    const ageMs = this.dbAgeMs(doc?.lastHeartbeat);

    const record: PresenceRecord = {
      state: dbOnline ? "online" : "offline",
      publishedOnline: dbOnline,
      socketOpen: false,
      lastSeenMonotonicMs:
        ageMs === null ? Number.NEGATIVE_INFINITY : nowMonotonic() - Math.max(0, ageMs),
      lastSeenAt: doc?.lastHeartbeat ? new Date(doc.lastHeartbeat) : new Date(0),
      confirmTimer: null,
      lastOrigin: null,
    };
    this.records.set(cleanId, record);
    return record;
  }

  private ageOf(record: PresenceRecord): number {
    if (!Number.isFinite(record.lastSeenMonotonicMs)) return Number.POSITIVE_INFINITY;
    return nowMonotonic() - record.lastSeenMonotonicMs;
  }

  private dbAgeMs(value: Date | string | null | undefined): number | null {
    if (!value) return null;
    const ms = new Date(value).getTime();
    if (!Number.isFinite(ms)) return null;
    return Date.now() - ms;
  }
}

export const devicePresenceService = new DevicePresenceService();

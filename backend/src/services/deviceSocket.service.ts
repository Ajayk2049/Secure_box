import { WebSocket } from "ws";
import crypto from "crypto";
import { Device } from "../models/Device.model.js";
import { Log } from "../models/Log.model.js";
import { wsService } from "./websocket.service.js";
import { fcmService } from "./fcm.service.js";
import { devicePresenceService } from "./devicePresence.service.js";
import { verifyDeviceKey, hashDeviceKey } from "../utils/crypto.js";
import { config } from "../config.js";
import type { PresenceState } from "./devicePresence.state.js";

interface ConnectedDevice {
  ws: WebSocket;
  deviceId: string;
  connectedAt: Date;
  lastHeartbeat: Date;
  missedPings: number;
}

export type DeviceSocketState = "OPEN" | "CONNECTING" | "CLOSING" | "CLOSED" | "UNKNOWN";

/**
 * Phase 1: RAM activity window for *socket* liveness (ghost detection and
 * diagnostics only). This is NEVER used to decide user-visible online status —
 * that is owned exclusively by devicePresenceService.getPresence().
 */
export const SOCKET_FRESHNESS_MS = 15_000;

/** Total silence after which a tracked socket is considered a ghost and terminated. */
export function getGhostTimeoutMs(): number {
  return (config.deviceGhostTimeoutSec || 45) * 1000;
}

/**
 * Phase 0/1 diagnostics: raw in-memory view of a hardware socket.
 * Read-only; used by the status-debug endpoint and watchdog tracing.
 */
export interface DeviceSocketSnapshot {
  tracked: boolean;
  state: DeviceSocketState;
  connectedAt: string | null;
  connectedForMs: number | null;
  lastActivityAt: string | null;
  lastActivityAgeMs: number | null;
  missedPings: number | null;
  isFresh: boolean;
  freshnessWindowMs: number;
  ghostTimeoutMs: number;
  /** Phase 1: presence view for the same device, straight from the authority. */
  presenceState: PresenceState | null;
  presencePublishedOnline: boolean | null;
  presenceSilenceMs: number | null;
}

function socketStateName(readyState: number): DeviceSocketState {
  switch (readyState) {
    case WebSocket.OPEN:
      return "OPEN";
    case WebSocket.CONNECTING:
      return "CONNECTING";
    case WebSocket.CLOSING:
      return "CLOSING";
    case WebSocket.CLOSED:
      return "CLOSED";
    default:
      return "UNKNOWN";
  }
}

function ageMsOf(date: Date | string | null | undefined, nowMs: number): number | null {
  if (!date) return null;
  const ms = new Date(date).getTime();
  if (!Number.isFinite(ms)) return null;
  return nowMs - ms;
}

class DeviceSocketService {
  private devices: Map<string, ConnectedDevice> = new Map();

  /**
   * Timing-safe verification of deviceId and deviceKey.
   */
  async authenticateDevice(
    deviceId: string,
    providedKey: string | undefined
  ): Promise<{ authorized: boolean; device?: any; reason?: string }> {
    if (!deviceId) {
      return { authorized: false, reason: "deviceId is required" };
    }

    const cleanId = deviceId.trim().toUpperCase();
    const device = await Device.findOne({ deviceId: cleanId }).select("+deviceKeyHash +deviceKey");
    if (!device) {
      return { authorized: false, reason: `Device '${cleanId}' not found` };
    }

    // Dev/demo mode bypass
    if (process.env.NODE_ENV !== "production") {
      if (process.env.DEMO_MODE === "true" || providedKey === "SIMULATOR_TEST_KEY") {
        if (!device.deviceKeyHash && !device.deviceKey) {
          const generated = `sbx_live_${crypto.randomBytes(16).toString("hex")}`;
          device.deviceKeyHash = hashDeviceKey(generated);
          await device.save();
        }
        return { authorized: true, device };
      }
    }

    if (!providedKey) {
      return { authorized: false, reason: "Missing deviceKey" };
    }

    const authCheck = verifyDeviceKey(providedKey, device.deviceKeyHash, device.deviceKey);
    if (!authCheck.valid) {
      return { authorized: false, reason: "Invalid deviceKey" };
    }

    // Zero-downtime auto-upgrade: upgrade legacy plaintext key to SHA-256 hash immediately
    if (authCheck.needsMigration) {
      device.deviceKeyHash = hashDeviceKey(providedKey);
      device.deviceKey = undefined;
      await device.save().catch((err) => console.error(`[AUTH-MIGRATION] Failed to upgrade device ${cleanId}:`, err));
      console.log(`[AUTH-MIGRATION] Automatically upgraded device ${cleanId} to SHA-256 hash.`);
    }

    return { authorized: true, device };
  }

  /**
   * Registers an authenticated ESP32 WebSocket connection.
   *
   * Phase 1: a reconnect is NOT a status event. It feeds proof-of-life into the
   * presence authority, which publishes `DEVICE_ONLINE` only on a real
   * offline -> online transition. No unconditional DB write, log, or push.
   */
  async registerDevice(deviceId: string, ws: WebSocket, deviceDoc: any): Promise<void> {
    const cleanId = deviceId.trim().toUpperCase();

    // Close any previous stale connection for this device
    const existing = this.devices.get(cleanId);
    const replacedLiveSocket = Boolean(
      existing && existing.ws !== ws && existing.ws.readyState === WebSocket.OPEN
    );
    if (replacedLiveSocket && existing) {
      try {
        existing.ws.close(4001, "New connection established for device");
      } catch { }
    }

    const now = new Date();
    const nowMs = now.getTime();
    this.devices.set(cleanId, {
      ws,
      deviceId: cleanId,
      connectedAt: now,
      lastHeartbeat: now,
      missedPings: 0,
    });

    console.log(`[DEVICE-WS] Hardware connected: ${cleanId}`);

    const before = devicePresenceService.getPresence(
      cleanId,
      deviceDoc.online,
      deviceDoc.lastHeartbeat
    );

    // The presence authority decides whether this is a user-visible transition.
    await devicePresenceService.noteSocketOpen(cleanId, deviceDoc);

    const after = devicePresenceService.getPresence(cleanId);

    console.log(
      `[DEVICE-STATUS-TRACE] at=${now.toISOString()} register_device device=${cleanId} ` +
        `prevTracked=${Boolean(existing)} prevSocketAgeMs=${ageMsOf(existing?.lastHeartbeat, nowMs)} ` +
        `prevMissedPings=${existing?.missedPings ?? "null"} replacedLiveSocket=${replacedLiveSocket} ` +
        `presenceBefore=${before.state} presenceAfter=${after.state} ` +
        `transition=${before.online ? "ONLINE_STAYED_ONLINE" : "OFFLINE_TO_ONLINE"} origin=esp32_websocket`
    );
  }

  /**
   * Handles hardware disconnect.
   *
   * Phase 1: a closed socket is not an offline decision either. The presence
   * authority keeps the device visible as online until the silence threshold
   * expires, so the frequent reconnects this locker produces stay invisible.
   * If a newer socket already replaced this one, the stale close is ignored.
   */
  async handleDisconnect(deviceId: string, ws?: WebSocket): Promise<void> {
    const cleanId = deviceId.trim().toUpperCase();
    const current = this.devices.get(cleanId);

    // Guard: If socket is already disconnected or belongs to an old replaced socket, do not process again
    if (!current || (ws && current.ws !== ws)) {
      return;
    }

    this.devices.delete(cleanId);
    const disconnectTime = new Date();

    console.log(
      `[DEVICE-STATUS-TRACE] at=${disconnectTime.toISOString()} handle_disconnect device=${cleanId} ` +
        `socketAgeMs=${ageMsOf(current.lastHeartbeat, disconnectTime.getTime())} ` +
        `missedPings=${current.missedPings} socketState=${socketStateName(current.ws.readyState)} ` +
        `presenceBefore=${devicePresenceService.getPresence(cleanId).state} ` +
        `decision=HOLD_ONLINE_UNTIL_SILENCE origin=esp32_websocket_disconnect`
    );
    console.log(`[DEVICE-WS] Hardware disconnected: ${cleanId}`);

    await devicePresenceService.noteSocketClosed(cleanId);
  }

  /**
   * Records proof-of-life on ANY incoming frame (telemetry, door event, ping, pong, heartbeat).
   * Refreshes RAM heartbeat and resets missed ping count to prevent false ghost-socket drops.
   *
   * Phase 1: every frame is also fed to the presence authority, which owns the
   * user-visible online status. This is the fix for defect A — the heartbeat
   * path no longer has to write to MongoDB at all.
   */
  touchActivity(deviceId: string): void {
    const cleanId = deviceId.trim().toUpperCase();
    const conn = this.devices.get(cleanId);
    if (conn) {
      conn.lastHeartbeat = new Date();
      conn.missedPings = 0;
    }
    void devicePresenceService.noteFrame(cleanId);
  }

  /**
   * Records proof-of-life on incoming native WebSocket pong or ping frame.
   */
  recordPong(deviceId: string): void {
    this.touchActivity(deviceId);
  }

  /**
   * Handles incoming heartbeat from ESP32.
   * Updates state purely in RAM to protect MongoDB from high-frequency disk I/O.
   */
  async handleHeartbeat(
    deviceId: string,
    telemetry?: { rssi?: number; battery?: number; uptime?: number }
  ): Promise<void> {
    const cleanId = deviceId.trim().toUpperCase();
    this.touchActivity(cleanId);
    const conn = this.devices.get(cleanId);
    const now = new Date();

    if (conn && conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(JSON.stringify({ type: "HEARTBEAT_ACK", timestamp: now.getTime() }));
    }
  }

  /**
   * Dead-socket sweeper: runs periodically (e.g. every 5s).
   * Sends RFC 6455 Ping frames and terminates sockets that have been silent for
   * longer than the ghost timeout.
   *
   * Phase 1: this is purely a *socket hygiene* routine. Terminating a ghost
   * socket never changes the user-visible online status — the presence authority
   * decides that from elapsed silence, using the same clock.
   */
  sweepConnections(): void {
    const now = Date.now();
    const ghostCutoffMs = getGhostTimeoutMs();

    for (const [cleanId, conn] of this.devices.entries()) {
      const timeSinceHeartbeat = now - conn.lastHeartbeat.getTime();

      // Time-only cutoff: a single silence window for both ghost reaping and
      // presence confirmation, so the two can never disagree.
      if (timeSinceHeartbeat > ghostCutoffMs) {
        console.log(
          `[DEVICE-WS] Device ${cleanId} silent for ${Math.round(timeSinceHeartbeat / 1000)}s ` +
            `(missed ${conn.missedPings} pings, ghostTimeout=${Math.round(ghostCutoffMs / 1000)}s). Terminating ghost socket.`
        );
        try {
          conn.ws.terminate();
        } catch { }
        void this.handleDisconnect(cleanId, conn.ws);
        continue;
      }

      // If socket is open, send native protocol ping and increment missed counter
      if (conn.ws.readyState === WebSocket.OPEN) {
        conn.missedPings++;
        try {
          conn.ws.ping();
        } catch {
          try { conn.ws.terminate(); } catch { }
          this.handleDisconnect(cleanId, conn.ws);
        }
      } else if (conn.ws.readyState !== WebSocket.CONNECTING) {
        this.handleDisconnect(cleanId, conn.ws);
      }
    }
  }

  /**
   * Handles door state change telemetry from ESP32.
   * Updates the door state in MongoDB and broadcasts it.
   *
   * Phase 1: this no longer writes `online = true` or `lastHeartbeat`. A door
   * event is proof of life (fed through `touchActivity`), but the online flag
   * and its broadcast come from the presence authority only — otherwise a
   * cybersecurity-relevant "online" claim could be manufactured by telemetry.
   */
  async handleDoorEvent(deviceId: string, doorState: "open" | "closed"): Promise<void> {
    const cleanId = deviceId.trim().toUpperCase();
    this.touchActivity(cleanId);

    const device = await Device.findOne({ deviceId: cleanId });
    if (!device) return;

    const previousState = device.doorState;
    device.doorState = doorState;
    await device.save();

    if (previousState !== doorState) {
      await Log.create({
        deviceId: device._id,
        action: doorState === "open" ? "door_opened" : "door_closed",
        metadata: { source: "esp32_sensor", deviceId: cleanId },
      });

      if (doorState === "open") {
        fcmService.notifyLockerOpened(device).catch((e) => console.error("[FCM] Locker opened notice error:", e));
      }
    }

    const presence = devicePresenceService.getPresence(
      cleanId,
      device.online,
      device.lastHeartbeat
    );

    const targets = [cleanId, device._id, device.ownerId, ...(device.coOwners || [])];
    wsService.broadcastToDeviceGroup(targets, {
      type: "DEVICE_STATUS",
      deviceId: cleanId,
      doorState,
      doorStatus: doorState === "closed" ? "locked" : "unlocked",
      online: presence.online,
    });
  }

  /**
   * Pushes instant unlock command to connected ESP32 in sub-millisecond time.
   * Defaults to 200ms power pulse to align with firmware DEFAULT_UNLOCK_DURATION.
   */
  sendUnlockCommand(deviceId: string, commandId: string, durationMs = 200): boolean {
    const cleanId = deviceId.trim().toUpperCase();
    const conn = this.devices.get(cleanId);
    if (!conn || conn.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    const payload = JSON.stringify({
      type: "UNLOCK",
      commandId,
      duration: durationMs,
    });
    conn.ws.send(payload);
    console.log(`[DEVICE-WS] Pushed instant UNLOCK to ${cleanId} (cmd: ${commandId}, duration: ${durationMs}ms)`);
    return true;
  }

  /**
   * Verifies if device has an active hardware WebSocket connection that communicated recently.
   */
  isDeviceConnected(deviceId: string): boolean {
    const cleanId = deviceId.trim().toUpperCase();
    const conn = this.devices.get(cleanId);
    if (!conn || conn.ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    // Verified alive in memory within the freshness window
    return Date.now() - conn.lastHeartbeat.getTime() < SOCKET_FRESHNESS_MS;
  }

  /**
   * Phase 0 diagnostics: read-only snapshot of the in-memory socket state.
   * Never mutates the registry; safe to call from request handlers.
   */
  getConnectionSnapshot(deviceId: string, nowMs: number = Date.now()): DeviceSocketSnapshot {
    const cleanId = (deviceId || "").trim().toUpperCase();
    const conn = this.devices.get(cleanId);
    const presence = devicePresenceService.peek(cleanId);

    const presenceFields = {
      presenceState: presence?.state ?? null,
      presencePublishedOnline: presence?.publishedOnline ?? null,
      presenceSilenceMs: presence?.lastSeenAgeMs ?? null,
    };

    if (!conn) {
      return {
        tracked: false,
        state: "CLOSED",
        connectedAt: null,
        connectedForMs: null,
        lastActivityAt: null,
        lastActivityAgeMs: null,
        missedPings: null,
        isFresh: false,
        freshnessWindowMs: SOCKET_FRESHNESS_MS,
        ghostTimeoutMs: getGhostTimeoutMs(),
        ...presenceFields,
      };
    }

    const lastActivityAgeMs = ageMsOf(conn.lastHeartbeat, nowMs);

    return {
      tracked: true,
      state: socketStateName(conn.ws.readyState),
      connectedAt: conn.connectedAt.toISOString(),
      connectedForMs: nowMs - conn.connectedAt.getTime(),
      lastActivityAt: conn.lastHeartbeat.toISOString(),
      lastActivityAgeMs,
      missedPings: conn.missedPings,
      isFresh:
        conn.ws.readyState === WebSocket.OPEN &&
        lastActivityAgeMs !== null &&
        lastActivityAgeMs < SOCKET_FRESHNESS_MS,
      freshnessWindowMs: SOCKET_FRESHNESS_MS,
      ghostTimeoutMs: getGhostTimeoutMs(),
      ...presenceFields,
    };
  }

  /** Device IDs currently tracked in RAM (OPEN sockets only). */
  getTrackedDeviceIds(): string[] {
    const ids: string[] = [];
    for (const [cleanId, conn] of this.devices.entries()) {
      if (conn.ws.readyState === WebSocket.OPEN) ids.push(cleanId);
    }
    return ids;
  }

  getConnectedCount(): number {
    return this.devices.size;
  }
}

export const deviceSocketService = new DeviceSocketService();

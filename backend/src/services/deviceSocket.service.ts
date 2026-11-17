import { WebSocket } from "ws";
import crypto from "crypto";
import { Device } from "../models/Device.model.js";
import { Log } from "../models/Log.model.js";
import { wsService } from "./websocket.service.js";
import { fcmService } from "./fcm.service.js";
import { deviceNotificationService } from "./deviceNotification.service.js";
import { verifyDeviceKey, hashDeviceKey } from "../utils/crypto.js";
import { config } from "../config.js";

interface ConnectedDevice {
  ws: WebSocket;
  deviceId: string;
  connectedAt: Date;
  lastHeartbeat: Date;
  missedPings: number;
}

export type DeviceSocketState = "OPEN" | "CONNECTING" | "CLOSING" | "CLOSED" | "UNKNOWN";

/** How recent RAM activity must be for a socket to count as "genuinely alive". */
export const SOCKET_FRESHNESS_MS = 15_000;

/** Fallback DB heartbeat window used by resolveDeviceOnline when no live socket exists. */
export const DB_HEARTBEAT_FALLBACK_MS = 25_000;

/** Total silence after which a tracked socket is considered a ghost and terminated. */
export function getGhostTimeoutMs(): number {
  return (config.deviceGhostTimeoutSec || 30) * 1000;
}

/**
 * Phase 0 diagnostics: raw in-memory view of a hardware socket.
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

    // Update MongoDB status to online with connection timestamp
    const onlineBefore = deviceDoc.online === true;
    const heartbeatBeforeAgeMs = ageMsOf(deviceDoc.lastHeartbeat, nowMs);
    deviceDoc.online = true;
    deviceDoc.lastHeartbeat = now;
    deviceDoc.lastConnectedAt = now;
    await deviceDoc.save().catch(() => { });

    console.log(
      `[DEVICE-STATUS-TRACE] at=${now.toISOString()} register_device device=${cleanId} ` +
        `prevTracked=${Boolean(existing)} prevSocketAgeMs=${ageMsOf(existing?.lastHeartbeat, nowMs)} ` +
        `prevMissedPings=${existing?.missedPings ?? "null"} replacedLiveSocket=${replacedLiveSocket} ` +
        `dbOnlineBefore=${onlineBefore} dbHeartbeatAgeBeforeMs=${heartbeatBeforeAgeMs} ` +
        `transition=${onlineBefore ? "ONLINE_STAYED_ONLINE" : "OFFLINE_TO_ONLINE"} source=esp32_websocket`
    );

    // Create persistent activity log record
    await Log.create({
      deviceId: deviceDoc._id,
      action: "device_online",
      timestamp: now,
      metadata: { source: "esp32_websocket", deviceId: cleanId },
    }).catch((err) => console.error(`[DEVICE-WS] Failed to log device_online for ${cleanId}:`, err));

    // Broadcast real-time online status to users & admins
    const targets = [cleanId, deviceDoc._id, deviceDoc.ownerId, ...(deviceDoc.coOwners || [])];
    wsService.broadcastToDeviceGroup(targets, {
      type: "DEVICE_ONLINE",
      deviceId: cleanId,
      timestamp: now.toISOString(),
    });
    wsService.broadcastToDeviceGroup(targets, {
      type: "DEVICE_STATUS",
      deviceId: cleanId,
      doorState: deviceDoc.doorState,
      doorStatus: deviceDoc.doorState === "closed" ? "locked" : "unlocked",
      online: true,
    });

    deviceNotificationService.handleDeviceOnline(deviceDoc);
  }

  /**
   * Handles hardware disconnect event immediately.
   * If a newer active socket already replaced this one or socket is already disconnected, stale socket close is ignored.
   */
  async handleDisconnect(deviceId: string, ws?: WebSocket): Promise<void> {
    const cleanId = deviceId.trim().toUpperCase();
    const current = this.devices.get(cleanId);

    // Guard: If socket is already disconnected or belongs to an old replaced socket, do not process again
    if (!current || (ws && current.ws !== ws)) {
      return;
    }

    this.devices.delete(cleanId);
    console.log(`[DEVICE-WS] Hardware disconnected: ${cleanId}`);

    try {
      const disconnectTime = new Date();
      // Atomic state transition: ONLY update and log if device was currently online (true -> false)
      const device = await Device.findOneAndUpdate(
        { deviceId: cleanId, online: true },
        { $set: { online: false, lastDisconnectedAt: disconnectTime } },
        { new: false }
      );

      console.log(
        `[DEVICE-STATUS-TRACE] at=${disconnectTime.toISOString()} handle_disconnect device=${cleanId} ` +
          `socketAgeMs=${ageMsOf(current.lastHeartbeat, disconnectTime.getTime())} ` +
          `missedPings=${current.missedPings} socketState=${socketStateName(current.ws.readyState)} ` +
          `dbOnlineBefore=${Boolean(device)} dbHeartbeatAgeMs=${ageMsOf(device?.lastHeartbeat, disconnectTime.getTime())} ` +
          `transition=${device ? "ONLINE_TO_OFFLINE" : "ALREADY_OFFLINE_NOOP"} source=esp32_websocket_disconnect`
      );

      // If device was already offline, avoid duplicate audit log and broadcast!
      if (!device) {
        return;
      }

      await Log.create({
        deviceId: device._id,
        action: "device_offline",
        timestamp: disconnectTime,
        metadata: { source: "esp32_websocket_disconnect", deviceId: cleanId },
      }).catch((err) => console.error(`[DEVICE-WS] Failed to log device_offline for ${cleanId}:`, err));

      const targets = [cleanId, device._id, device.ownerId, ...(device.coOwners || [])];
      wsService.broadcastToDeviceGroup(targets, {
        type: "DEVICE_OFFLINE",
        deviceId: cleanId,
        timestamp: disconnectTime.toISOString(),
      });
      wsService.broadcastToDeviceGroup(targets, {
        type: "DEVICE_STATUS",
        deviceId: cleanId,
        online: false,
        doorState: device.doorState,
      });

      deviceNotificationService.scheduleOfflineNotification(device);
    } catch (err) {
      console.error(`[DEVICE-WS] Error handling disconnect for ${cleanId}:`, err);
    }
  }

  /**
   * Records proof-of-life on ANY incoming frame (telemetry, door event, ping, pong, heartbeat).
   * Refreshes RAM heartbeat and resets missed ping count to prevent false ghost-socket drops.
   */
  touchActivity(deviceId: string): void {
    const cleanId = deviceId.trim().toUpperCase();
    const conn = this.devices.get(cleanId);
    if (conn) {
      conn.lastHeartbeat = new Date();
      conn.missedPings = 0;
    }
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
   * Actively sends RFC 6455 Ping frames and terminates unresponsive ghost sockets after 25s–30s.
   */
  sweepConnections(): void {
    const now = Date.now();
    const ghostCutoffMs = getGhostTimeoutMs();

    for (const [cleanId, conn] of this.devices.entries()) {
      const timeSinceHeartbeat = now - conn.lastHeartbeat.getTime();

      // Ghost socket if device missed 5 consecutive pings (~25s) or total silence exceeds threshold (30s)
      if (conn.missedPings >= 5 || timeSinceHeartbeat > ghostCutoffMs) {
        console.log(
          `[DEVICE-WS] Device ${cleanId} unresponsive for ${Math.round(timeSinceHeartbeat / 1000)}s (missed ${conn.missedPings} pings). Terminating ghost socket.`
        );
        try {
          conn.ws.terminate();
        } catch { }
        this.handleDisconnect(cleanId, conn.ws);
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
   * Updates MongoDB cloud state as authoritative source of truth.
   */
  async handleDoorEvent(deviceId: string, doorState: "open" | "closed"): Promise<void> {
    const cleanId = deviceId.trim().toUpperCase();
    this.touchActivity(cleanId);

    const device = await Device.findOne({ deviceId: cleanId });
    if (!device) return;

    const previousState = device.doorState;
    device.doorState = doorState;
    device.online = true;
    device.lastHeartbeat = new Date();
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

    const targets = [cleanId, device._id, device.ownerId, ...(device.coOwners || [])];
    wsService.broadcastToDeviceGroup(targets, {
      type: "DEVICE_STATUS",
      deviceId: cleanId,
      doorState,
      doorStatus: doorState === "closed" ? "locked" : "unlocked",
      online: true,
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

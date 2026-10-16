import { WebSocket } from "ws";
import crypto from "crypto";
import { Device } from "../models/Device.model.js";
import { Log } from "../models/Log.model.js";
import { wsService } from "./websocket.service.js";

interface ConnectedDevice {
  ws: WebSocket;
  deviceId: string;
  connectedAt: Date;
  lastHeartbeat: Date;
  isAlive: boolean;
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
    const device = await Device.findOne({ deviceId: cleanId });
    if (!device) {
      return { authorized: false, reason: `Device '${cleanId}' not found` };
    }

    // Dev/demo mode bypass
    if (process.env.NODE_ENV !== "production") {
      if (process.env.DEMO_MODE === "true" || providedKey === "SIMULATOR_TEST_KEY") {
        if (!device.deviceKey) {
          device.deviceKey = `sbx_live_${crypto.randomBytes(16).toString("hex")}`;
          await device.save();
        }
        return { authorized: true, device };
      }
    }

    if (!device.deviceKey || !providedKey) {
      return { authorized: false, reason: "Missing deviceKey" };
    }

    const providedBuf = Buffer.from(providedKey.trim());
    const actualBuf = Buffer.from(device.deviceKey.trim());
    if (providedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(providedBuf, actualBuf)) {
      return { authorized: false, reason: "Invalid deviceKey" };
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
    if (existing && existing.ws !== ws && existing.ws.readyState === WebSocket.OPEN) {
      try {
        existing.ws.close(4001, "New connection established for device");
      } catch { }
    }

    const now = new Date();
    this.devices.set(cleanId, {
      ws,
      deviceId: cleanId,
      connectedAt: now,
      lastHeartbeat: now,
      isAlive: true,
    });

    console.log(`[DEVICE-WS] Hardware connected: ${cleanId}`);

    // Update MongoDB status to online with connection timestamp
    deviceDoc.online = true;
    deviceDoc.lastHeartbeat = now;
    deviceDoc.lastConnectedAt = now;
    await deviceDoc.save().catch(() => { });

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
  }

  /**
   * Handles hardware disconnect event immediately.
   * If a newer active socket already replaced this one, stale socket close is ignored.
   */
  async handleDisconnect(deviceId: string, ws?: WebSocket): Promise<void> {
    const cleanId = deviceId.trim().toUpperCase();
    const current = this.devices.get(cleanId);

    // Guard: If this disconnect event belongs to an old replaced socket, do not mark offline!
    if (ws && current && current.ws !== ws) {
      return;
    }

    this.devices.delete(cleanId);
    console.log(`[DEVICE-WS] Hardware disconnected: ${cleanId}`);

    try {
      const device = await Device.findOne({ deviceId: cleanId });
      if (device) {
        const disconnectTime = new Date();
        device.online = false;
        device.lastDisconnectedAt = disconnectTime;
        await device.save();

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
      }
    } catch (err) {
      console.error(`[DEVICE-WS] Error handling disconnect for ${cleanId}:`, err);
    }
  }

  /**
   * Handles incoming heartbeat from ESP32.
   */
  async handleHeartbeat(
    deviceId: string,
    telemetry?: { rssi?: number; battery?: number; uptime?: number }
  ): Promise<void> {
    const cleanId = deviceId.trim().toUpperCase();
    const conn = this.devices.get(cleanId);
    const now = new Date();
    if (conn) {
      conn.lastHeartbeat = now;
      conn.isAlive = true;
    }

    await Device.updateOne(
      { deviceId: cleanId },
      { $set: { online: true, lastHeartbeat: now } }
    ).catch(() => { });

    if (conn && conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(JSON.stringify({ type: "HEARTBEAT_ACK", timestamp: now.getTime() }));
    }
  }

  /**
   * Handles door state change telemetry from ESP32.
   */
  async handleDoorEvent(deviceId: string, doorState: "open" | "closed"): Promise<void> {
    const cleanId = deviceId.trim().toUpperCase();
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
   */
  sendUnlockCommand(deviceId: string, commandId: string, durationMs = 3000): boolean {
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
    console.log(`[DEVICE-WS] Pushed instant UNLOCK to ${cleanId} (cmd: ${commandId})`);
    return true;
  }

  isDeviceConnected(deviceId: string): boolean {
    const cleanId = deviceId.trim().toUpperCase();
    const conn = this.devices.get(cleanId);
    return Boolean(conn && conn.ws.readyState === WebSocket.OPEN);
  }

  getConnectedCount(): number {
    return this.devices.size;
  }
}

export const deviceSocketService = new DeviceSocketService();

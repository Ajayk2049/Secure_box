import mongoose from "mongoose";
import { Device, IDevice } from "../models/Device.model.js";
import { Log } from "../models/Log.model.js";
import { User } from "../models/User.model.js";
import {
  deviceSocketService,
  SOCKET_FRESHNESS_MS,
  getGhostTimeoutMs,
  type DeviceSocketSnapshot,
} from "./deviceSocket.service.js";
import { devicePresenceService, type PresenceView } from "./devicePresence.service.js";
import { commandQueueService } from "./commandQueue.service.js";
import { wsService } from "./websocket.service.js";
import { config } from "../config.js";

/**
 * Phase 1: `ram_presence` is the only live decision path. `db_fallback` means the
 * device has no RAM record (e.g. after a restart) and the DB projection inside
 * the restart window is all we have. `offline` is a confirmed offline.
 */
export type StatusDecisionPath = "ram_presence" | "db_fallback" | "offline";

export interface DeviceStatusDebug {
  deviceId: string;
  name: string | null;
  sampledAt: string;
  effectiveOnline: boolean;
  decisionPath: StatusDecisionPath;
  /** Phase 1: the authority's own answer, verbatim. */
  presence: PresenceView;
  db: {
    online: boolean;
    lastHeartbeat: string | null;
    lastHeartbeatAgeMs: number | null;
    lastConnectedAt: string | null;
    lastDisconnectedAt: string | null;
  };
  socket: DeviceSocketSnapshot;
  thresholds: {
    socketFreshnessMs: number;
    suspectMs: number;
    offlineMs: number;
    persistMs: number;
    restartFallbackMs: number;
    ghostTimeoutMs: number;
    offlineGraceMs: number;
  };
  inconsistencies: string[];
}

function decisionPathFor(presence: PresenceView): StatusDecisionPath {
  if (!presence.online) return "offline";
  return presence.source === "ram" ? "ram_presence" : "db_fallback";
}

export class DeviceStatusService {
  /**
   * Phase 1: a single call into the presence authority. No independent
   * heuristics, no second clock, no DB-timestamp short-circuit.
   */
  private evaluate(
    deviceId: string,
    dbOnline: boolean | undefined,
    lastHeartbeat: Date | string | null | undefined
  ): PresenceView {
    return devicePresenceService.getPresence(deviceId, dbOnline, lastHeartbeat);
  }

  /**
   * Evaluates live presence view. Returns the authority's complete answer.
   */
  getDevicePresence(
    deviceId: string,
    dbOnline?: boolean,
    lastHeartbeat?: Date | string | null
  ): PresenceView {
    if (!deviceId) return devicePresenceService.getPresence("");
    const cleanId = deviceId.trim().toUpperCase();
    return this.evaluate(cleanId, dbOnline, lastHeartbeat);
  }

  /**
   * Evaluates live online status. Returns the authority's answer.
   */
  resolveDeviceOnline(
    deviceId: string,
    dbOnline?: boolean,
    lastHeartbeat?: Date | string | null
  ): boolean {
    if (!deviceId) return false;
    const cleanId = deviceId.trim().toUpperCase();
    return this.evaluate(cleanId, dbOnline, lastHeartbeat).online;
  }

  /**
   * Phase 0/1: read-only diagnostic snapshot used by GET /devices/:id/status-debug.
   * Reports the authority's answer, each producer's raw value, and the
   * inconsistencies between them.
   */
  buildStatusDebug(device: any, nowMs = Date.now()): DeviceStatusDebug {
    const cleanId = String(device.deviceId || "").trim().toUpperCase();
    const dbOnline = device.online === true;
    const presence = this.evaluate(cleanId, dbOnline, device.lastHeartbeat);
    const socket = deviceSocketService.getConnectionSnapshot(cleanId, nowMs);
    const heartbeatAgeMs = device.lastHeartbeat
      ? nowMs - new Date(device.lastHeartbeat).getTime()
      : null;
    const ghostTimeoutMs = getGhostTimeoutMs();

    const inconsistencies: string[] = [];
    if (!dbOnline && presence.online) {
      inconsistencies.push("presence_online_but_db_offline");
    }
    if (dbOnline && !presence.online) {
      inconsistencies.push("presence_offline_but_db_online");
    }
    if (dbOnline && presence.online && (heartbeatAgeMs === null || heartbeatAgeMs > config.deviceHeartbeatPersistSec * 1000)) {
      inconsistencies.push("db_heartbeat_stale_but_presence_online");
    }
    if (socket.tracked && socket.state !== "OPEN") {
      inconsistencies.push("socket_tracked_but_not_open");
    }
    if (socket.tracked && !socket.isFresh && presence.online) {
      inconsistencies.push("socket_silent_but_presence_online");
    }
    if (!socket.tracked && presence.source === "untracked") {
      inconsistencies.push("no_ram_record_since_boot");
    }

    return {
      deviceId: cleanId,
      name: device.name ?? null,
      sampledAt: new Date(nowMs).toISOString(),
      effectiveOnline: presence.online,
      decisionPath: decisionPathFor(presence),
      presence,
      db: {
        online: dbOnline,
        lastHeartbeat: device.lastHeartbeat ? new Date(device.lastHeartbeat).toISOString() : null,
        lastHeartbeatAgeMs: heartbeatAgeMs,
        lastConnectedAt: device.lastConnectedAt ? new Date(device.lastConnectedAt).toISOString() : null,
        lastDisconnectedAt: device.lastDisconnectedAt ? new Date(device.lastDisconnectedAt).toISOString() : null,
      },
      socket,
      thresholds: {
        socketFreshnessMs: SOCKET_FRESHNESS_MS,
        suspectMs: config.devicePresenceSuspectSec * 1000,
        offlineMs: config.devicePresenceOfflineSec * 1000,
        persistMs: config.deviceHeartbeatPersistSec * 1000,
        restartFallbackMs: config.deviceRestartFallbackSec * 1000,
        ghostTimeoutMs,
        offlineGraceMs: config.deviceOfflineGracePeriodSec * 1000,
      },
      inconsistencies,
    };
  }

  /**
   * Enriches a device object with verified real-time online status.
   */
  enrichWithLiveStatus<T extends Record<string, any>>(deviceObj: T): T & { online: boolean; statusVersion?: number; lastSeen?: string | null } {
    const presence = this.getDevicePresence(
      deviceObj.deviceId,
      deviceObj.online,
      deviceObj.lastHeartbeat
    );
    return {
      ...deviceObj,
      online: presence.online,
      statusVersion: presence.statusVersion,
      lastSeen: presence.lastSeenAt ? new Date(presence.lastSeenAt).toISOString() : null,
    };
  }

  /**
   * Helper to verify if user has access to a device.
   * NOTE: Admins are strictly prohibited from unlocking customer lockers (Zero Trust & Privacy).
   */
  isAuthorizedUser(device: any, userId: string, role = "user"): boolean {
    if (role === "admin") return false;
    if (!userId || !device) return false;
    const cleanUserId = userId.toString().trim();
    const ownerIdStr = (device.ownerId?._id || device.ownerId)?.toString().trim();
    if (ownerIdStr && ownerIdStr === cleanUserId) return true;

    if (Array.isArray(device.coOwners)) {
      return device.coOwners.some((c: any) => {
        const cId = (c?._id || c)?.toString().trim();
        return cId === cleanUserId;
      });
    }

    return false;
  }

  /**
   * Centralized unlock execution for both HTTP and WebSocket requests.
   * Dispatches instant unlock directly to ESP32 over active hardware WebSocket.
   */
  async executeUnlock(
    userId: string,
    userRole = "user",
    deviceIdOrId: string,
    durationMs = 200
  ): Promise<{
    success: boolean;
    message: string;
    commandId: string;
    unlockedBy?: string;
    userRole?: string;
    device: {
      deviceId: string;
      name: string;
      doorState: string;
      online: boolean;
    };
  }> {
    // Zero-Trust Guard: Admins are strictly prohibited from unlocking customer lockers
    if (userRole === "admin") {
      throw new Error("Admins are strictly prohibited from unlocking customer lockers for security and privacy.");
    }

    const target = (deviceIdOrId || "").trim();
    if (!target) {
      throw new Error("Device ID is required");
    }

    let device: any = null;
    if (mongoose.Types.ObjectId.isValid(target)) {
      device = await Device.findById(target);
    }
    if (!device) {
      device = await Device.findOne({ deviceId: target.toUpperCase() });
    }

    if (!device) {
      throw new Error(`Device '${target}' not found`);
    }

    if (!this.isAuthorizedUser(device, userId, userRole)) {
      throw new Error("Not authorized to unlock this locker");
    }

    const cleanDeviceId = device.deviceId.toUpperCase();
    const isLiveOnline = this.resolveDeviceOnline(cleanDeviceId, device.online, device.lastHeartbeat);
    if (!isLiveOnline) {
      throw new Error(`Cannot unlock: Locker '${cleanDeviceId}' is currently offline`);
    }

    const enqueued = commandQueueService.enqueueCommand(cleanDeviceId, "unlock");

    // Real-time sub-50ms dispatch over open hardware WebSocket
    const isDirectlyPushed = deviceSocketService.sendUnlockCommand(
      cleanDeviceId,
      enqueued.commandId,
      durationMs
    );

    // Fetch user details for audit log
    const userDoc = await User.findById(userId).select("name email phone").lean();
    const userName = userDoc?.name || (userRole === "admin" ? "Admin" : "User");

    await Log.create({
      deviceId: device._id,
      action: "unlock",
      metadata: {
        commandId: enqueued.commandId,
        source: isDirectlyPushed ? "websocket_instant" : "command_queue",
        unlockedBy: userName,
        userName,
        userRole,
        userId,
        deviceId: cleanDeviceId,
      },
    });

    const targets = [cleanDeviceId, device._id, device.ownerId, ...(device.coOwners || [])];
    wsService.broadcastToDeviceGroup(targets, {
      type: "UNLOCK_COMMAND",
      deviceId: cleanDeviceId,
      commandId: enqueued.commandId,
      unlockedBy: userName,
    });

    return {
      success: true,
      message: isDirectlyPushed
        ? "Unlock command dispatched in real-time to locker"
        : "Unlock command queued successfully for device",
      commandId: enqueued.commandId,
      unlockedBy: userName,
      userRole,
      device: {
        deviceId: cleanDeviceId,
        name: device.name,
        doorState: device.doorState,
        online: isLiveOnline,
      },
    };
  }

  /**
   * Live system statistics combining DB counts with real-time socket connections.
   */
  async getSystemLiveStats(): Promise<{
    totalDevices: number;
    onlineDevices: number;
    totalUsers: number;
    totalLogs: number;
  }> {
    const totalDevices = await Device.countDocuments();
    const totalUsers = await User.countDocuments({ role: { $ne: "admin" } });
    const totalLogs = await Log.countDocuments();

    // Accurately compute online devices using the live socket registry and fallback threshold
    const devices = await Device.find().select("deviceId online lastHeartbeat").lean();
    const onlineDevices = devices.filter((d) =>
      this.resolveDeviceOnline(d.deviceId, d.online, d.lastHeartbeat)
    ).length;

    return {
      totalDevices,
      onlineDevices,
      totalUsers,
      totalLogs,
    };
  }
}

export const deviceStatusService = new DeviceStatusService();

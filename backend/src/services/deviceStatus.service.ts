import mongoose from "mongoose";
import { Device, IDevice } from "../models/Device.model.js";
import { Log } from "../models/Log.model.js";
import { User } from "../models/User.model.js";
import { deviceSocketService } from "./deviceSocket.service.js";
import { commandQueueService } from "./commandQueue.service.js";
import { wsService } from "./websocket.service.js";

export class DeviceStatusService {
  /**
   * Evaluates live online status: checks active hardware WebSocket first,
   * falling back to 45s heartbeat window.
   */
  resolveDeviceOnline(
    deviceId: string,
    dbOnline?: boolean,
    lastHeartbeat?: Date | string | null
  ): boolean {
    if (!deviceId) return false;
    const cleanId = deviceId.trim().toUpperCase();

    // 1. Direct hardware WebSocket check (Primary Source of Truth)
    if (deviceSocketService.isDeviceConnected(cleanId)) {
      return true;
    }

    // 2. Fallback to fresh heartbeat threshold (45 seconds)
    if (dbOnline && lastHeartbeat) {
      const hbTime = new Date(lastHeartbeat).getTime();
      return Date.now() - hbTime < 45000;
    }

    return false;
  }

  /**
   * Enriches a device object with verified real-time online status.
   */
  enrichWithLiveStatus<T extends Record<string, any>>(deviceObj: T): T & { online: boolean } {
    const isOnline = this.resolveDeviceOnline(
      deviceObj.deviceId,
      deviceObj.online,
      deviceObj.lastHeartbeat
    );
    return {
      ...deviceObj,
      online: isOnline,
    };
  }

  /**
   * Helper to verify if user has access to a device.
   */
  isAuthorizedUser(device: any, userId: string, role = "user"): boolean {
    if (role === "admin") return true;
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
    durationMs = 3000
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

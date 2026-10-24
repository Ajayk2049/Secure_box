import { WebSocket } from "ws";
import mongoose from "mongoose";
import { Device } from "../models/Device.model.js";
import { eventBus } from "./eventBus.service.js";

interface Client {
  ws: WebSocket;
  userId: string;
  role: string;
  rooms: Set<string>;
}

class WebSocketService {
  private clients: Map<string, Client> = new Map();
  // Reverse indices for O(1) broadcast routing without full-table scans
  private roomSubscribers: Map<string, Set<string>> = new Map();
  private adminClients: Set<string> = new Set();

  constructor() {
    // Listen for cluster-wide broadcast events from other PM2 workers
    eventBus.subscribe("WS_BROADCAST_GROUP", (data: { targets: string[]; message: any; originNodeId?: string }) => {
      if (data.originNodeId !== eventBus.getNodeId()) {
        this.dispatchLocalGroupBroadcast(data.targets, data.message);
      }
    });

    eventBus.subscribe("WS_BROADCAST_ALL", (data: { message: any; originNodeId?: string }) => {
      if (data.originNodeId !== eventBus.getNodeId()) {
        this.dispatchLocalAllBroadcast(data.message);
      }
    });
  }

  private addSubscriberToRoom(room: string, clientId: string): void {
    const clean = room.trim();
    if (!clean) return;
    const upper = clean.toUpperCase();

    for (const key of [clean, upper]) {
      if (!this.roomSubscribers.has(key)) {
        this.roomSubscribers.set(key, new Set());
      }
      this.roomSubscribers.get(key)!.add(clientId);
    }
  }

  private removeSubscriberFromRoom(room: string, clientId: string): void {
    const clean = room.trim();
    if (!clean) return;
    const upper = clean.toUpperCase();

    for (const key of [clean, upper]) {
      const set = this.roomSubscribers.get(key);
      if (set) {
        set.delete(clientId);
        if (set.size === 0) {
          this.roomSubscribers.delete(key);
        }
      }
    }
  }

  async addClient(clientId: string, ws: WebSocket, userId: string, role = "user"): Promise<void> {
    const client: Client = { ws, userId, role, rooms: new Set() };
    this.clients.set(clientId, client);

    if (role === "admin") {
      this.adminClients.add(clientId);
    }

    if (userId) {
      client.rooms.add(userId);
      this.addSubscriberToRoom(userId, clientId);

      // Auto-subscribe the client to all devices they own or co-own immediately upon connection
      try {
        const userDevices = await Device.find({
          $or: [{ ownerId: userId }, { coOwners: userId }],
        })
          .select("deviceId _id")
          .lean();

        for (const d of userDevices) {
          const devUpper = d.deviceId.toUpperCase();
          const devIdStr = d._id.toString();
          client.rooms.add(devUpper);
          client.rooms.add(devIdStr);
          this.addSubscriberToRoom(devUpper, clientId);
          this.addSubscriberToRoom(devIdStr, clientId);
        }
      } catch (err) {
        console.error(`[WS] Auto-subscription error for user ${userId}:`, err);
      }
    }
  }

  removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    if (client.role === "admin") {
      this.adminClients.delete(clientId);
    }

    // Clean up reverse index registrations
    for (const room of client.rooms) {
      this.removeSubscriberFromRoom(room, clientId);
    }

    this.clients.delete(clientId);
  }

  async joinRoom(clientId: string, deviceId: string): Promise<boolean> {
    const client = this.clients.get(clientId);
    if (!client || !deviceId) return false;

    const clean = deviceId.trim();
    const upper = clean.toUpperCase();

    // If client is already subscribed to this room, skip redundant DB check
    if (client.rooms.has(upper) || client.rooms.has(clean)) {
      return true;
    }

    // Admins have access to monitor all devices
    if (client.role === "admin") {
      client.rooms.add(upper);
      client.rooms.add(clean);
      this.addSubscriberToRoom(upper, clientId);
      this.addSubscriberToRoom(clean, clientId);
      return true;
    }

    // Verify ownership in MongoDB (matching by deviceId string or ObjectId)
    try {
      const isObjectId = mongoose.isValidObjectId(clean);
      const query = isObjectId
        ? { $or: [{ deviceId: upper }, { _id: clean }] }
        : { deviceId: upper };

      const device = await Device.findOne(query);
      if (!device) {
        client.ws.send(JSON.stringify({ type: "ERROR", error: `Device ${upper} not found` }));
        return false;
      }

      const isOwner = device.ownerId.toString() === client.userId;
      const isCoOwner = device.coOwners.some((cId) => cId.toString() === client.userId);

      if (!isOwner && !isCoOwner) {
        client.ws.send(JSON.stringify({ type: "ERROR", error: `Unauthorized to monitor device ${upper}` }));
        return false;
      }

      client.rooms.add(upper);
      client.rooms.add(device.deviceId.toUpperCase());
      client.rooms.add(device._id.toString());

      this.addSubscriberToRoom(upper, clientId);
      this.addSubscriberToRoom(device.deviceId.toUpperCase(), clientId);
      this.addSubscriberToRoom(device._id.toString(), clientId);

      return true;
    } catch (err) {
      console.error(`Error verifying device ownership for room ${clean}:`, err);
      return false;
    }
  }

  /**
   * Dispatches broadcast locally to indexed room subscribers and admin listeners.
   * High performance: O(1) indexed lookup instead of O(N) client-scan.
   * Backpressure protected: skips slow clients when buffer >= 64KB.
   */
  private dispatchLocalGroupBroadcast(targets: string[], message: Record<string, unknown>): void {
    const validTargets = new Set<string>();
    for (const t of targets) {
      if (t) {
        const str = t.toString().trim();
        if (str) {
          validTargets.add(str);
          validTargets.add(str.toUpperCase());
        }
      }
    }

    if (validTargets.size === 0) return;

    // Collect matching client IDs using reverse index
    const recipientClientIds = new Set<string>(this.adminClients);
    for (const target of validTargets) {
      const subscribers = this.roomSubscribers.get(target);
      if (subscribers) {
        for (const cid of subscribers) {
          recipientClientIds.add(cid);
        }
      }
    }

    if (recipientClientIds.size === 0) return;
    const payload = JSON.stringify(message);

    for (const cid of recipientClientIds) {
      const client = this.clients.get(cid);
      if (client && client.ws.readyState === WebSocket.OPEN) {
        // Backpressure check: avoid buffering frames on slow or stalled mobile clients
        if (client.ws.bufferedAmount < 65536) {
          client.ws.send(payload);
        }
      }
    }
  }

  private dispatchLocalAllBroadcast(message: Record<string, unknown>): void {
    const payload = JSON.stringify(message);
    this.clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN && client.ws.bufferedAmount < 65536) {
        client.ws.send(payload);
      }
    });
  }

  broadcastToDeviceGroup(
    targets: (string | mongoose.Types.ObjectId | undefined | null)[],
    message: Record<string, unknown>
  ): void {
    const strTargets: string[] = [];
    for (const t of targets) {
      if (t) strTargets.push(t.toString().trim());
    }

    // Local dispatch
    this.dispatchLocalGroupBroadcast(strTargets, message);

    // Cluster distribution across horizontal PM2 processes
    eventBus.publish("WS_BROADCAST_GROUP", {
      targets: strTargets,
      message,
      originNodeId: eventBus.getNodeId(),
    });
  }

  broadcastToDevice(deviceId: string, message: Record<string, unknown>): void {
    this.broadcastToDeviceGroup([deviceId], message);
  }

  broadcastToAll(message: Record<string, unknown>): void {
    this.dispatchLocalAllBroadcast(message);

    // Cluster distribution
    eventBus.publish("WS_BROADCAST_ALL", {
      message,
      originNodeId: eventBus.getNodeId(),
    });
  }

  getClientCount(): number {
    return this.clients.size;
  }
}

export const wsService = new WebSocketService();

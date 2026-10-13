import { WebSocket } from "ws";
import mongoose from "mongoose";
import { Device } from "../models/Device.model.js";

interface Client {
  ws: WebSocket;
  userId: string;
  role: string;
  rooms: Set<string>;
}

class WebSocketService {
  private clients: Map<string, Client> = new Map();

  async addClient(clientId: string, ws: WebSocket, userId: string, role = "user"): Promise<void> {
    const client: Client = { ws, userId, role, rooms: new Set([userId]) };
    this.clients.set(clientId, client);
    console.log(`[WS] Client connected: ${clientId} (user: ${userId}, role: ${role})`);

    // Auto-subscribe the client to all devices they own or co-own immediately upon connection
    if (userId) {
      try {
        const userDevices = await Device.find({
          $or: [{ ownerId: userId }, { coOwners: userId }],
        })
          .select("deviceId _id")
          .lean();

        for (const d of userDevices) {
          client.rooms.add(d.deviceId.toUpperCase());
          client.rooms.add(d._id.toString());
        }
        console.log(`[WS] Auto-subscribed client ${clientId} to ${userDevices.length} devices.`);
      } catch (err) {
        console.error(`[WS] Auto-subscription error for user ${userId}:`, err);
      }
    }
  }

  removeClient(clientId: string): void {
    this.clients.delete(clientId);
    console.log(`[WS] Client disconnected: ${clientId}`);
  }

  async joinRoom(clientId: string, deviceId: string): Promise<boolean> {
    const client = this.clients.get(clientId);
    if (!client || !deviceId) return false;

    const clean = deviceId.trim();
    const upper = clean.toUpperCase();

    // If client is already subscribed to this room, skip redundant DB check and log spam
    if (client.rooms.has(upper) || client.rooms.has(clean)) {
      return true;
    }

    // Admins have access to monitor all devices
    if (client.role === "admin") {
      client.rooms.add(upper);
      client.rooms.add(clean);
      console.log(`[WS] Admin ${clientId} joined room: ${upper}`);
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
      console.log(`[WS] Authorized user ${client.userId} joined room: ${upper}`);
      return true;
    } catch (err) {
      console.error(`Error verifying device ownership for room ${clean}:`, err);
      return false;
    }
  }

  broadcastToDeviceGroup(
    targets: (string | mongoose.Types.ObjectId | undefined | null)[],
    message: Record<string, unknown>
  ): void {
    const validTargets = new Set<string>();
    for (const t of targets) {
      if (t) {
        const str = t.toString().trim();
        if (str) {
          validTargets.add(str);
          validTargets.add(str.toUpperCase());
          validTargets.add(str.toLowerCase());
        }
      }
    }

    if (validTargets.size === 0) return;
    const payload = JSON.stringify(message);

    this.clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        const matches =
          validTargets.has(client.userId) ||
          Array.from(client.rooms).some((r) => validTargets.has(r));
        if (matches) {
          client.ws.send(payload);
        }
      }
    });
  }

  broadcastToDevice(deviceId: string, message: Record<string, unknown>): void {
    this.broadcastToDeviceGroup([deviceId], message);
  }

  broadcastToAll(message: Record<string, unknown>): void {
    const payload = JSON.stringify(message);
    this.clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    });
  }

  getClientCount(): number {
    return this.clients.size;
  }
}

export const wsService = new WebSocketService();

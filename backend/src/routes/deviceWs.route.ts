import { FastifyInstance } from "fastify";
import { deviceSocketService } from "../services/deviceSocket.service.js";

export async function deviceWsRoute(fastify: FastifyInstance) {
  // Support both singular and plural, with or without /api prefix
  const wsPaths = ["/ws/device", "/ws/devices", "/api/ws/device", "/api/ws/devices"];

  for (const path of wsPaths) {
    fastify.get(path, { websocket: true }, async (socket, request) => {
      const query = request.query as { deviceId?: string; deviceKey?: string } | undefined;
      const headerKey = request.headers["x-device-key"] as string | undefined;

      let deviceId = (query?.deviceId || "").trim().toUpperCase();
      let deviceKey = (query?.deviceKey || headerKey || "").trim();

      let authenticated = false;

      // 1. Initial authentication check via URL query parameters
      if (deviceId && deviceKey) {
        const authResult = await deviceSocketService.authenticateDevice(deviceId, deviceKey);
        if (authResult.authorized) {
          authenticated = true;
          await deviceSocketService.registerDevice(deviceId, socket, authResult.device);
          socket.send(JSON.stringify({ type: "AUTH_OK", deviceId }));
        } else {
          socket.close(4401, authResult.reason || "Unauthorized device");
          return;
        }
      }

      // 2. Incoming message handler
      socket.on("message", async (rawMessage) => {
        try {
          const data = JSON.parse(rawMessage.toString());

          // Handle late auth handshake if not provided in URL
          if (!authenticated && data.type === "AUTH") {
            deviceId = (data.deviceId || "").trim().toUpperCase();
            deviceKey = (data.deviceKey || "").trim();
            const authResult = await deviceSocketService.authenticateDevice(deviceId, deviceKey);
            if (authResult.authorized) {
              authenticated = true;
              await deviceSocketService.registerDevice(deviceId, socket, authResult.device);
              socket.send(JSON.stringify({ type: "AUTH_OK", deviceId }));
              return;
            } else {
              socket.close(4401, authResult.reason || "Unauthorized device");
              return;
            }
          }

          if (!authenticated) {
            socket.close(4401, "Authentication required");
            return;
          }

          switch (data.type) {
            case "PING":
              socket.send(JSON.stringify({ type: "PONG" }));
              break;

            case "HEARTBEAT":
              await deviceSocketService.handleHeartbeat(deviceId, {
                rssi: data.rssi,
                battery: data.battery,
                uptime: data.uptime,
              });
              break;

            case "TELEMETRY":
            case "DOOR_EVENT": {
              const rawStatus = (data.doorState || data.doorStatus || data.state || "").toString().toLowerCase();
              let state: "open" | "closed" = "closed";
              if (["open", "opened", "unlock", "unlocked", "ajar"].includes(rawStatus)) {
                state = "open";
              }
              await deviceSocketService.handleDoorEvent(deviceId, state);
              break;
            }

            case "UNLOCK_ACK":
              fastify.log.info({ deviceId, commandId: data.commandId, status: data.status }, "[DEVICE-WS] Unlock executed by hardware");
              break;

            default:
              break;
          }
        } catch (err) {
          fastify.log.error(err, "[DEVICE-WS] Error processing incoming device frame");
        }
      });

      // 3. Native WebSocket ping listener (RFC 6455 protocol ping from webSocket.enableHeartbeat)
      socket.on("ping", () => {
        if (authenticated && deviceId) {
          deviceSocketService.handleHeartbeat(deviceId).catch(() => {});
        }
      });

      // 4. Disconnection handler
      socket.on("close", () => {
        if (authenticated && deviceId) {
          deviceSocketService.handleDisconnect(deviceId, socket).catch(() => {});
        }
      });

      socket.on("error", (err) => {
        fastify.log.warn({ err, deviceId }, "[DEVICE-WS] Socket error occurred on device connection");
      });
    });
  }
}

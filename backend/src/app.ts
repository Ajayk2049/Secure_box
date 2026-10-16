import Fastify from "fastify";
import mongoose from "mongoose";
import { config } from "./config.js";
import { checkDeviceWatchdog } from "./services/deviceWatchdog.service.js";
import { wsService } from "./services/websocket.service.js";
import { deviceStatusService } from "./services/deviceStatus.service.js";
import { User } from "./models/User.model.js";
import { Device } from "./models/Device.model.js";
import { loggerConfig, loggerStream, isSilentTerminalPath, logFilePath, pruneLogsOlderThan24Hours } from "./logger.js";
import { AppError, ValidationError } from "./errors/AppError.js";

import jwtPlugin from "./plugins/jwt.plugin.js";
import corsPlugin from "./plugins/cors.plugin.js";
import helmetPlugin from "./plugins/helmet.plugin.js";
import websocketPlugin from "./plugins/websocket.plugin.js";
import rateLimitPlugin from "./plugins/rateLimit.plugin.js";
import mongoSanitizePlugin from "./plugins/mongoSanitize.plugin.js";

import authRoutes from "./routes/auth.routes.js";
import deviceRoutes from "./routes/device.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import { deviceWsRoute } from "./routes/deviceWs.route.js";
import { simulatorHtml } from "./simulator.html.js";

const fastify = Fastify({
  trustProxy: true,
  logger: {
    ...loggerConfig,
    stream: loggerStream,
  },
  disableRequestLogging: true, // We take control of request logging to silence OPTIONS and print clean lines
});

function sanitizeLogUrl(url: string): string {
  return url.replace(/([?&](?:token|adminToken)=)[^&]+/gi, "$1[REDACTED]");
}

// Custom clean request and error hooks
fastify.addHook("onRequest", async (request) => {
  if (isSilentTerminalPath(request.url, request.method)) return;
  request.log.info(`--> ${request.method} ${sanitizeLogUrl(request.url)}`);
});

fastify.addHook("onResponse", async (request, reply) => {
  if (isSilentTerminalPath(request.url, request.method)) return;
  const ms = reply.elapsedTime.toFixed(1);
  const status = reply.statusCode;
  const statusTag = status >= 500 ? "[ERR]" : status >= 400 ? "[WARN]" : "[OK]";
  request.log.info(`${statusTag} ${request.method} ${sanitizeLogUrl(request.url)} ${status} (${ms}ms)`);
});

function redactSensitiveData(data: any): any {
  if (!data || typeof data !== "object") return data;
  if (Array.isArray(data)) return data.map(redactSensitiveData);

  const sensitiveKeys = new Set([
    "password",
    "otp",
    "token",
    "refreshtoken",
    "devicekey",
    "secret",
    "authorization",
    "admin_initial_password",
  ]);

  const sanitized: Record<string, any> = {};
  for (const [key, val] of Object.entries(data)) {
    if (sensitiveKeys.has(key.toLowerCase())) {
      sanitized[key] = "[REDACTED]";
    } else if (val && typeof val === "object") {
      sanitized[key] = redactSensitiveData(val);
    } else {
      sanitized[key] = val;
    }
  }
  return sanitized;
}

fastify.addHook("onError", async (request, reply, error) => {
  request.log.error(
    {
      err: error,
      url: request.url,
      method: request.method,
      body: redactSensitiveData(request.body),
    },
    `[ERROR] Error handling ${request.method} ${request.url}: ${error.message}`
  );
});

// Global Error Handler (Rules.md Section 22.13: Never leak internal DB error or stack trace to client)
fastify.setErrorHandler((error: any, request, reply) => {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: error.message,
      code: error.code,
      ...(error instanceof ValidationError ? { fieldErrors: error.fieldErrors } : {}),
    });
  }

  // Handle Fastify schema validation errors
  if (error.validation) {
    return reply.status(400).send({
      error: error.message,
      code: "VALIDATION_ERROR",
    });
  }

  // Client 4xx errors
  const statusCode = error.statusCode && error.statusCode >= 400 && error.statusCode < 500 ? error.statusCode : 500;
  if (statusCode < 500) {
    return reply.status(statusCode).send({
      error: error.message || "Bad Request",
    });
  }

  // Generic sanitized 500 response to prevent internal leaks
  return reply.status(500).send({
    error: "Internal Server Error. Please try again later.",
    code: "INTERNAL_SERVER_ERROR",
  });
});

async function bootstrap() {
  await fastify.register(corsPlugin);
  await fastify.register(helmetPlugin);
  await fastify.register(rateLimitPlugin);
  await fastify.register(mongoSanitizePlugin);
  await fastify.register(jwtPlugin);
  await fastify.register(websocketPlugin);

  // Allow empty or blank JSON bodies (e.g. Flutter Dio POST without payload)
  fastify.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (req, body, done) => {
      if (!body || (typeof body === "string" && body.trim() === "")) {
        return done(null, {});
      }
      try {
        return done(null, JSON.parse(body as string));
      } catch (err: any) {
        err.statusCode = 400;
        return done(err, undefined);
      }
    }
  );

  // Deep Health checks (validating service status and MongoDB connection)
  const healthHandler = async (_request: any, reply: any) => {
    const isDbConnected = mongoose.connection.readyState === 1;
    const statusCode = isDbConnected ? 200 : 503;
    return reply.status(statusCode).send({
      status: isDbConnected ? "ok" : "degraded",
      service: "smart-locker-backend",
      database: isDbConnected ? "connected" : "disconnected",
      timestamp: new Date().toISOString(),
    });
  };
  fastify.get("/health", healthHandler);
  fastify.get("/api/health", healthHandler);

  // Virtual ESP32 Hardware Simulator GUI (Protected: disabled in production unless admin authenticated)
  fastify.get("/simulator", async (request, reply) => {
    if (process.env.NODE_ENV === "production") {
      const token = (request.query as { token?: string })?.token;
      if (!token) {
        return reply.status(403).send({ error: "Simulator is disabled in production environments" });
      }
      try {
        const decoded: any = fastify.jwt.verify(token);
        if (decoded?.role !== "admin") {
          return reply.status(403).send({ error: "Unauthorized access to hardware simulator" });
        }
      } catch {
        return reply.status(401).send({ error: "Invalid admin token" });
      }
    }
    reply.header("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    reply.header("Pragma", "no-cache");
    reply.header("Expires", "0");
    return reply.type("text/html").send(simulatorHtml);
  });

  // Routes
  await fastify.register(authRoutes, { prefix: "/api/auth" });
  await fastify.register(deviceRoutes, { prefix: "/api" });
  await fastify.register(adminRoutes, { prefix: "/api" });
  await fastify.register(deviceWsRoute);

  fastify.get("/ws", { websocket: true }, async (socket, request) => {
    const query = request.query as { token?: string } | undefined;
    const authHeader = request.headers.authorization;
    const token = query?.token || (authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null);

    if (!token) {
      socket.close(4401, "Authentication token required");
      return;
    }

    let decodedUser: { id: string; role?: string };
    try {
      decodedUser = fastify.jwt.verify(token) as { id: string; role?: string };
    } catch {
      socket.close(4401, "Invalid or expired token");
      return;
    }

    const clientId = Math.random().toString(36).substring(7);
    wsService.addClient(clientId, socket, decodedUser.id, decodedUser.role || "user");

    socket.on("message", async (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === "PING") {
          socket.send(JSON.stringify({ type: "PONG" }));
          return;
        }
        if (data.type === "JOIN_ROOM" && data.deviceId) {
          await wsService.joinRoom(clientId, data.deviceId);
          return;
        }
        if (data.type === "UNLOCK_DEVICE" && data.deviceId) {
          try {
            const result = await deviceStatusService.executeUnlock(
              decodedUser.id,
              decodedUser.role || "user",
              data.deviceId,
              typeof data.duration === "number" ? data.duration : 3000
            );
            socket.send(JSON.stringify({
              type: "UNLOCK_ACK",
              success: true,
              deviceId: data.deviceId,
              message: result.message,
              commandId: result.commandId,
              device: result.device,
            }));
          } catch (unlockErr: any) {
            socket.send(JSON.stringify({
              type: "UNLOCK_ACK",
              success: false,
              deviceId: data.deviceId,
              error: unlockErr.message || "Failed to unlock device",
            }));
          }
          return;
        }
        if (data.type === "GET_DEVICES") {
          const query = (decodedUser.role === "admin")
            ? {}
            : { $or: [{ ownerId: decodedUser.id }, { coOwners: decodedUser.id }] };
          const devices = await Device.find(query).populate("ownerId", "phone email name").lean();
          const enriched = devices.map((d: any) => deviceStatusService.enrichWithLiveStatus(d));
          socket.send(JSON.stringify({
            type: "DEVICES_UPDATE",
            devices: enriched,
          }));
          return;
        }
      } catch (error) {
        fastify.log.error(error, "WS message parse error");
      }
    });

    socket.on("close", () => {
      wsService.removeClient(clientId);
    });
  });

  // Mongoose Security Hardening & Connection Resilience (Rules.md Section 22.5)
  mongoose.set("strictQuery", true);
  mongoose.connection.on("disconnected", () => {
    fastify.log.warn("[WARN] MongoDB connection lost. Attempting auto-reconnect...");
  });
  mongoose.connection.on("error", (err) => {
    fastify.log.error(err, "[ERROR] MongoDB connection error occurred");
  });

  await mongoose.connect(config.mongodbUri, {
    maxPoolSize: 50,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });
  fastify.log.info("[OK] MongoDB connected (maxPoolSize: 50)");

  // Sync MongoDB indexes (drop legacy non-sparse email index if present)
  await User.collection.dropIndex("email_1").catch(() => {});
  await User.syncIndexes().catch(() => {});

  // Start periodic watchdog timer for IoT device connectivity (runs every 10s)
  const watchdogInterval = setInterval(checkDeviceWatchdog, 10 * 1000);
  // Prune logs older than 24 hours on startup and periodically every hour
  pruneLogsOlderThan24Hours().catch(() => {});
  const logPruneInterval = setInterval(() => {
    pruneLogsOlderThan24Hours().catch((err) => {
      fastify.log.error(err, "Failed to prune logs older than 24 hours");
    });
  }, 60 * 60 * 1000);
  fastify.log.info("[CLEANUP] 24-hour log cleanup worker active (1h cycle)");

  // Graceful Shutdown Handlers (SIGTERM / SIGINT)
  const gracefulShutdown = async (signal: string) => {
    fastify.log.info(`[SHUTDOWN] Received ${signal}. Draining requests and closing connections cleanly...`);
    clearInterval(watchdogInterval);
    clearInterval(logPruneInterval);
    try {
      await fastify.close();
      await mongoose.disconnect();
      fastify.log.info("[SHUTDOWN] Clean shutdown complete. Exiting gracefully.");
      process.exit(0);
    } catch (err) {
      fastify.log.error(err, "[SHUTDOWN ERROR] Error during graceful shutdown");
      process.exit(1);
    }
  };

  process.once("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.once("SIGINT", () => gracefulShutdown("SIGINT"));

  await fastify.listen({ port: config.port, host: "0.0.0.0" });
  fastify.log.info(`[READY] Server running on port ${config.port}`);
  fastify.log.info(`[LOGS] Persistent log file active at: ${logFilePath}`);
}

bootstrap().catch((err) => {
  console.error("[ERROR] Failed to start server:", err);
  process.exit(1);
});

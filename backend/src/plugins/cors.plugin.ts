import fp from "fastify-plugin";
import cors from "@fastify/cors";
import { FastifyInstance } from "fastify";
import { config } from "../config.js";

export default fp(async (fastify: FastifyInstance) => {
  const allowedOriginsSet = new Set(config.allowedOrigins);

  await fastify.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin or non-browser/hardware origins
      // (ESP32 WebSocketsClient, native mobile apps, background curl)
      if (
        !origin ||
        origin === "null" ||
        origin === "file://" ||
        origin.startsWith("file:") ||
        origin.includes("arduino") ||
        origin.includes("esp32")
      ) {
        return cb(null, true);
      }

      // Check centralized allowlist from config (Zero-Hardcoding Rule 8)
      if (allowedOriginsSet.has(origin)) {
        return cb(null, true);
      }

      try {
        const url = new URL(origin);
        const hostname = url.hostname;

        // In non-production environments, allow localhost and loopback interfaces
        if (
          config.demoMode &&
          (hostname === "localhost" ||
            hostname === "127.0.0.1" ||
            hostname === "::1" ||
            hostname.startsWith("192.168.") ||
            hostname.startsWith("10.") ||
            /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname))
        ) {
          return cb(null, true);
        }
      } catch {
        return cb(null, false);
      }

      // Strictly deny any unapproved web origin
      cb(null, false);
    },
    credentials: true,
  });
});

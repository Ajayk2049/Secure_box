import fp from "fastify-plugin";
import cors from "@fastify/cors";
import { FastifyInstance } from "fastify";

export default fp(async (fastify: FastifyInstance) => {
  // Explicit origin allowlist (Next.js Admin & Landing web apps, plus localhost/LAN during dev)
  const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:3002",
  ];

  await fastify.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (like mobile apps, curl, postman, hardware simulator)
      if (!origin) return cb(null, true);

      // Check explicit allowlist
      if (allowedOrigins.includes(origin)) {
        return cb(null, true);
      }

      try {
        const url = new URL(origin);
        const hostname = url.hostname;

        // 1. Allow localhost, loopback, and local network IPs
        if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
          return cb(null, true);
        }

        // 2. Allow any IPv4 address for VPS testing (e.g., http://<vps-ip>:<port>)
        if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
          return cb(null, true);
        }

        // 3. Strict domain check (prevents attacker-yourdomain.com subdomain bypasses)
        if (hostname === "yourdomain.com" || hostname.endsWith(".yourdomain.com")) {
          return cb(null, true);
        }
      } catch {
        // Malformed origin URL
      }

      cb(new Error("CORS policy does not allow access from this origin"), false);
    },
    credentials: true,
  });
});

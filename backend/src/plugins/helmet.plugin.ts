import fp from "fastify-plugin";
import helmet from "@fastify/helmet";
import { FastifyInstance } from "fastify";
import { config } from "../config.js";

export default fp(async (fastify: FastifyInstance) => {
  // Derive allowed frame-ancestors strictly from centralized config (Zero-Hardcoding Rule 8)
  const frameAncestors = ["'self'", ...config.allowedOrigins];

  await fastify.register(helmet, {
    // Only enable HSTS when deployed behind an HTTPS reverse proxy with SSL certificate
    hsts: false,
    frameguard: false,
    noSniff: true,
    xssFilter: true,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'", "ws:", "wss:", "http:", "https:"],
        frameAncestors: frameAncestors,
        upgradeInsecureRequests: null, // Avoid breaking direct IP:Port HTTP routing
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  });
});

import fp from "fastify-plugin";
import helmet from "@fastify/helmet";
import { FastifyInstance } from "fastify";

export default fp(async (fastify: FastifyInstance) => {
  const isProd = process.env.NODE_ENV === "production";
  // Origins allowed to embed backend pages (e.g. /simulator iframed by Admin dashboard).
  // Supports local development, IP-based VPS staging/testing, and domain-based production.
  const frameAncestors = [
    "'self'",
    "http://localhost:*",
    "http://127.0.0.1:*",
    "http://*:3000",
    "http://*:3001",
    "http://*:3002",
    "http://*:*",
    "https://*.yourdomain.com",
    "https://yourdomain.com",
  ];

  await fastify.register(helmet, {
    // Enable HSTS (Strict-Transport-Security) for 1 year including subdomains
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    // Clickjacking: CSP frame-ancestors (allowlist above) replaces X-Frame-Options,
    // because "DENY"/"SAMEORIGIN" would block the Admin dashboard iframe in any case.
    frameguard: false,
    // Protect against MIME-type sniffing
    noSniff: true,
    // Protect against XSS
    xssFilter: true,
    // Content Security Policy
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        scriptSrcElem: ["'self'", "'unsafe-inline'"],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'", "ws:", "wss:", "http:", "https:"],
        frameAncestors: frameAncestors,
        upgradeInsecureRequests: process.env.NODE_ENV === "production" ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false, // Allows cross-origin asset loading for APIs
    crossOriginResourcePolicy: { policy: "cross-origin" },
  });
});

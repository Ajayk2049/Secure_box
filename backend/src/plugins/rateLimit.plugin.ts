import fp from "fastify-plugin";
import rateLimit from "@fastify/rate-limit";
import { FastifyInstance } from "fastify";

export default fp(async (fastify: FastifyInstance) => {
  const isDev = process.env.NODE_ENV !== "production";

  await fastify.register(rateLimit, {
    global: true,
    max: isDev ? 1000 : 100, // Generous 1000/min in dev for testing/simulators; 100/min standard in production
    timeWindow: "1 minute",
    allowList: (req) => {
      // Allow WebSockets, internal health checks, and hardware simulator from global rate limits
      const url = req.url || "";
      return (
        url.startsWith("/ws") ||
        url.startsWith("/health") ||
        url.startsWith("/api/health") ||
        url.startsWith("/simulator")
      );
    },
    errorResponseBuilder: (req, context) => ({
      statusCode: 429,
      error: "Too Many Requests",
      message: `Rate limit exceeded. You can send up to ${context.max} requests per ${context.after}. Please try again later.`,
      retryAfter: context.after,
    }),
  });
});

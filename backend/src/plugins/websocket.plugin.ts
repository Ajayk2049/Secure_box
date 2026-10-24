import fp from "fastify-plugin";
import websocket from "@fastify/websocket";
import { FastifyInstance } from "fastify";

export default fp(async (fastify: FastifyInstance) => {
  await fastify.register(websocket, {
    options: {
      maxPayload: 64 * 1024, // 64 KB max frame size (prevents 100MB unbounded memory exhaustion DoS)
    },
  });
});

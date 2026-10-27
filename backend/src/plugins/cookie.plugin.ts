import fp from "fastify-plugin";
import cookie, { FastifyCookieOptions } from "@fastify/cookie";
import { FastifyInstance } from "fastify";
import { config } from "../config.js";

export default fp(async (fastify: FastifyInstance) => {
  await fastify.register(cookie, {
    secret: config.jwtSecret,
    hook: "onRequest",
  } as FastifyCookieOptions);
});

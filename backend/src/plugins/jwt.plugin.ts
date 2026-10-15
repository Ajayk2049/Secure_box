import fp from "fastify-plugin";
import fjwt from "@fastify/jwt";
import { FastifyInstance } from "fastify";
import { config } from "../config.js";

export default fp(async (fastify: FastifyInstance) => {
  fastify.register(fjwt, {
    secret: config.jwtSecret,
    sign: { expiresIn: config.jwtExpiresIn },
    verify: { algorithms: ["HS256"] },
  });

  fastify.decorate("authenticate", async (request: any, reply: any) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.status(401).send({ error: "Unauthorized" });
    }
  });
});

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<void>;
  }
}

import { FastifyRequest, FastifyReply } from "fastify";

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  try {
    const cookieToken = (request as any).cookies?.admin_token;
    if (cookieToken) {
      request.user = (request.server as any).jwt.verify(cookieToken);
      return;
    }
    await request.jwtVerify();
  } catch (err) {
    return reply.status(401).send({ error: "Unauthorized" });
  }
}

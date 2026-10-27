import { FastifyRequest, FastifyReply } from "fastify";

export async function adminMiddleware(request: FastifyRequest, reply: FastifyReply) {
  try {
    const cookieToken = (request as any).cookies?.admin_token;
    if (cookieToken) {
      request.user = (request.server as any).jwt.verify(cookieToken);
    } else {
      await request.jwtVerify();
    }
    const user = request.user as { role?: string };
    if (!user || user.role !== "admin") {
      return reply.status(403).send({ error: "Forbidden: Admin access required" });
    }
  } catch (err) {
    return reply.status(401).send({ error: "Unauthorized" });
  }
}

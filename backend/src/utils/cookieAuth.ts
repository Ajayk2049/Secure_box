import { FastifyRequest, FastifyReply } from "fastify";

export function isSecureConnection(request: FastifyRequest): boolean {
  return request.protocol === "https" || process.env.COOKIE_SECURE === "true";
}

export function setAuthCookies(
  request: FastifyRequest,
  reply: FastifyReply,
  token: string,
  refreshToken?: string
) {
  const isSecure = isSecureConnection(request);

  // Short-lived access token cookie (Path: /)
  reply.setCookie("admin_token", token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure,
    maxAge: 2 * 60 * 60, // 2 hours
  });

  // Long-lived refresh token cookie scoped strictly to auth endpoints (Path: /api/auth)
  if (refreshToken) {
    reply.setCookie("admin_refresh_token", refreshToken, {
      path: "/api/auth",
      httpOnly: true,
      sameSite: "lax",
      secure: isSecure,
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });
  }
}

export function clearAuthCookies(reply: FastifyReply) {
  reply.clearCookie("admin_token", { path: "/" });
  reply.clearCookie("admin_refresh_token", { path: "/api/auth" });
}

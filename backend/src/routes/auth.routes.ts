import { FastifyInstance } from "fastify";
import { 
  sendOtp, 
  checkPhone, 
  registerWithOtp, 
  login, 
  getMe, 
  placeOrder, 
  updateProfile,
  refreshTokenHandler,
  logoutHandler,
  resetPassword,
} from "../controllers/auth.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { validateBody } from "../middlewares/validate.middleware.js";
import {
  checkPhoneSchema,
  sendOtpSchema,
  registerWithOtpSchema,
  loginSchema,
  refreshTokenSchema,
  updateProfileSchema,
  placeOrderSchema,
  resetPasswordSchema,
} from "../schemas/auth.schemas.js";

export default async function authRoutes(fastify: FastifyInstance) {
  const isProd = process.env.NODE_ENV === "production";

  // 1a. Check Phone Number (Max 10 / minute in prod)
  fastify.post("/check-phone", {
    ...(isProd ? { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } } : {}),
    preHandler: [validateBody(checkPhoneSchema)],
    handler: checkPhone,
  });

  // 1b. Smart Pre-Check & Send OTP (Rate limited: Max 5 / minute)
  fastify.post("/send-otp", {
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
    preHandler: [validateBody(sendOtpSchema)],
    handler: sendOtp,
  });

  // 2. Register Account with OTP (+ optional Join Code) (Max 5 / minute in prod)
  fastify.post("/register-with-otp", {
    ...(isProd ? { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } } : {}),
    preHandler: [validateBody(registerWithOtpSchema)],
    handler: registerWithOtp,
  });

  // Also support /register as an alias to registerWithOtp
  fastify.post("/register", {
    ...(isProd ? { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } } : {}),
    preHandler: [validateBody(registerWithOtpSchema)],
    handler: registerWithOtp,
  });

  // 3. Login (via Mobile Number OR Email + Password) (Max 5 / minute in prod)
  fastify.post("/login", {
    ...(isProd ? { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } } : {}),
    preHandler: [validateBody(loginSchema)],
    handler: login,
  });

  // 3b. Refresh Access Token with Token Rotation (Max 20 / minute in prod)
  fastify.post("/refresh", {
    ...(isProd ? { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } } : {}),
    preHandler: [validateBody(refreshTokenSchema)],
    handler: refreshTokenHandler,
  });

  // 3c. Logout and Revoke Refresh Token
  fastify.post("/logout", {
    handler: logoutHandler,
  });

  // 3d. Self-Service Password Reset via Phone OTP (Rate limited: Max 5 / minute)
  fastify.post("/reset-password", {
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
    preHandler: [validateBody(resetPasswordSchema)],
    handler: resetPassword,
  });

  // 4. Current user session / profile
  fastify.get("/me", {
    preHandler: [authMiddleware],
    handler: getMe,
  });

  // 5. Update user profile (Name, Email)
  fastify.patch("/profile", {
    preHandler: [authMiddleware, validateBody(updateProfileSchema)],
    handler: updateProfile,
  });

  // 6. Place a Secure Box Order (Logged-in User)
  fastify.post("/order", {
    preHandler: [authMiddleware, validateBody(placeOrderSchema)],
    handler: placeOrder,
  });
}

import { z } from "zod";

export const sendOtpSchema = z.object({
  phone: z.string().min(1, "Mobile number is required"),
  type: z.enum(["register", "reset"]).optional().default("register"),
});

export const checkPhoneSchema = z.object({
  phone: z.string().min(1, "Mobile number is required"),
});

export const checkEmailSchema = z.object({
  email: z.string().email("Please enter a valid email address (e.g. name@example.com)"),
});

export const registerWithOtpSchema = z.object({
  phone: z.string().min(1, "Mobile number is required"),
  otp: z.string().min(4, "OTP must be at least 4 digits"),
  password: z.string().min(6, "Password must be at least 6 characters long").max(12, "Password must not exceed 12 characters"),
  email: z.string().email("Please enter a valid email address (e.g. name@example.com)").optional(),
  name: z.string().optional(),
  inviteCode: z.string().optional(),
  address: z.string().optional(),
  pincode: z.string().optional(),
  units: z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)]).optional(),
});

export const loginSchema = z.object({
  identifier: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  password: z.string().min(1, "Password is required").max(12, "Password must not exceed 12 characters"),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export const logoutSchema = z.object({
  refreshToken: z.string().optional(),
});

export const placeOrderSchema = z.object({
  address: z.string().min(1, "Doorstep delivery address is required"),
  pincode: z.string().optional(),
  units: z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)]).optional(),
});

export const updateProfileSchema = z.object({
  name: z.string().min(1, "Name cannot be empty").optional(),
  email: z.string().email("Please enter a valid email address (e.g. name@example.com)").optional().or(z.literal("")),
});

export const resetPasswordSchema = z.object({
  phone: z.string().min(1, "Mobile number is required"),
  otp: z.string().min(4, "OTP must be at least 4 digits"),
  newPassword: z.string().min(6, "New password must be at least 6 characters long").max(12, "Password must not exceed 12 characters"),
});

import { z } from "zod";

const envSchema = z.object({
  PORT: z.string().default("3000"),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  JWT_SECRET: z
    .string()
    .min(24, "JWT_SECRET must be at least 24 characters for cryptographic security")
    .refine(
      (s) => !["secret", "1234567890", "default_secret", "changeme", "admin12345678"].includes(s.toLowerCase().trim()),
      { message: "JWT_SECRET must not use a weak or predictable default value" }
    ),
  RESEND_API_KEY: z.string().optional(),
  STARTMESSAGING_API_KEY: z.string().min(1, "STARTMESSAGING_API_KEY must be defined in .env"),
  OTP_TEMPLATE_ID: z.string().min(1, "OTP_TEMPLATE_ID must be defined in .env"),
  DEMO_MODE: z.string().default("false"),
  JWT_EXPIRES_IN: z.string().default("15m"),
  REFRESH_TOKEN_EXPIRES_DAYS: z.string().default("7"),
  ALLOWED_ORIGINS: z.string().default(""),
});

type Env = z.infer<typeof envSchema>;

let _env: Env;

try {
  _env = envSchema.parse(process.env);
} catch (error) {
  console.error("[CONFIG ERROR] Invalid environment variables:", error);
  process.exit(1);
}

// Fallback default origins for local development when ALLOWED_ORIGINS is not set
const defaultDevOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "http://localhost:4000",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:3002",
  "http://127.0.0.1:4000",
];

const parsedAllowedOrigins = _env.ALLOWED_ORIGINS.trim()
  ? _env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
  : defaultDevOrigins;

export const config = {
  port: parseInt(_env.PORT, 10),
  mongodbUri: _env.MONGODB_URI,
  jwtSecret: _env.JWT_SECRET,
  jwtExpiresIn: _env.JWT_EXPIRES_IN,
  refreshTokenExpiresDays: parseInt(_env.REFRESH_TOKEN_EXPIRES_DAYS, 10),
  resendApiKey: _env.RESEND_API_KEY,
  startMessagingApiKey: _env.STARTMESSAGING_API_KEY,
  otpTemplateId: _env.OTP_TEMPLATE_ID,
  demoMode: _env.DEMO_MODE.toLowerCase() === "true",
  allowedOrigins: parsedAllowedOrigins,
} as const;

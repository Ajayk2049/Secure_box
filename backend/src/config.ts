import { z } from "zod";

const envSchema = z.object({
  PORT: z.string().default("3000"),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  RESEND_API_KEY: z.string().optional(),
  STARTMESSAGING_API_KEY: z.string().min(1, "STARTMESSAGING_API_KEY must be defined in .env"),
  OTP_TEMPLATE_ID: z.string().min(1, "OTP_TEMPLATE_ID must be defined in .env"),
  DEMO_MODE: z.string().default("false"),
  JWT_EXPIRES_IN: z.string().default("15m"),
  REFRESH_TOKEN_EXPIRES_DAYS: z.string().default("7"),
});

type Env = z.infer<typeof envSchema>;

let _env: Env;

try {
  _env = envSchema.parse(process.env);
} catch (error) {
  console.error("[CONFIG ERROR] Invalid environment variables:", error);
  process.exit(1);
}

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
} as const;

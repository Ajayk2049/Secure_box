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
  JWT_EXPIRES_IN: z.string().default("7d"),
  REFRESH_TOKEN_EXPIRES_DAYS: z.string().default("30"),
  ALLOWED_ORIGINS: z.string().default(""),
  TRUST_PROXY: z.string().default("false"),
  DEVICE_OFFLINE_GRACE_PERIOD_SEC: z.string().default("30"),
  DEVICE_WATCHDOG_INTERVAL_SEC: z.string().default("5"),
  DEVICE_GHOST_TIMEOUT_SEC: z.string().default("45"),
  DEVICE_PRESENCE_SUSPECT_SEC: z.string().default("25"),
  DEVICE_PRESENCE_OFFLINE_SEC: z.string().default("90"),
  DEVICE_HEARTBEAT_PERSIST_SEC: z.string().default("60"),
  DEVICE_RESTART_FALLBACK_SEC: z.string().default("180"),
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

function parseTrustProxy(val?: string): boolean | number | string | string[] {
  if (!val || val.toLowerCase() === "false") return false;
  if (val.toLowerCase() === "true") return true;
  const num = Number(val);
  if (!isNaN(num) && Number.isInteger(num) && num > 0) return num;
  const ips = val.split(",").map((s) => s.trim()).filter(Boolean);
  return ips.length === 1 ? ips[0]! : ips;
}

/**
 * Device presence timing (Phase 1).
 * All knobs are validated here so a bad .env can never boot a broken presence
 * model: invalid combinations log a warning and fall back to the safe defaults.
 */
const PRESENCE_DEFAULTS = {
  suspectSec: 25,
  offlineSec: 90,
  persistSec: 60,
  restartFallbackSec: 180,
} as const;

function positiveSeconds(raw: string | undefined, fallback: number, min = 5): number {
  const parsed = parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < min) return fallback;
  return parsed;
}

function resolvePresenceTiming(env: Env) {
  const suspectSec = positiveSeconds(env.DEVICE_PRESENCE_SUSPECT_SEC, PRESENCE_DEFAULTS.suspectSec);
  const offlineSec = positiveSeconds(env.DEVICE_PRESENCE_OFFLINE_SEC, PRESENCE_DEFAULTS.offlineSec);
  const persistSec = positiveSeconds(env.DEVICE_HEARTBEAT_PERSIST_SEC, PRESENCE_DEFAULTS.persistSec);
  const restartFallbackSec = positiveSeconds(env.DEVICE_RESTART_FALLBACK_SEC, PRESENCE_DEFAULTS.restartFallbackSec);

  // A device may not be confirmed offline before it is even suspected, and the
  // DB projection must land well inside the confirmation window.
  if (suspectSec >= offlineSec || persistSec >= offlineSec) {
    console.warn(
      `[CONFIG WARN] Invalid presence timing (suspect=${suspectSec}s offline=${offlineSec}s persist=${persistSec}s). ` +
        `Falling back to suspect=${PRESENCE_DEFAULTS.suspectSec}s offline=${PRESENCE_DEFAULTS.offlineSec}s persist=${PRESENCE_DEFAULTS.persistSec}s.`
    );
    return { ...PRESENCE_DEFAULTS };
  }

  // After a restart the DB projection is the only evidence we have, so it must
  // be trusted slightly longer than one persist cycle.
  const resolvedRestartFallbackSec =
    restartFallbackSec > persistSec ? restartFallbackSec : persistSec + 60;

  return { suspectSec, offlineSec, persistSec, restartFallbackSec: resolvedRestartFallbackSec };
}

const presenceTiming = resolvePresenceTiming(_env);

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
  trustProxy: parseTrustProxy(_env.TRUST_PROXY),
  deviceOfflineGracePeriodSec: parseInt(_env.DEVICE_OFFLINE_GRACE_PERIOD_SEC, 10) || 30,
  deviceWatchdogIntervalSec: parseInt(_env.DEVICE_WATCHDOG_INTERVAL_SEC, 10) || 5,
  deviceGhostTimeoutSec: parseInt(_env.DEVICE_GHOST_TIMEOUT_SEC, 10) || 45,
  // Phase 1 — single source of truth for presence (see devicePresence.service.ts)
  devicePresenceSuspectSec: presenceTiming.suspectSec,
  devicePresenceOfflineSec: presenceTiming.offlineSec,
  deviceHeartbeatPersistSec: presenceTiming.persistSec,
  deviceRestartFallbackSec: presenceTiming.restartFallbackSec,
} as const;

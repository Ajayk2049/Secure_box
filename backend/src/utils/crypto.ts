import crypto from "crypto";

/**
 * Generates a high-entropy secret hardware provisioning key for the ESP32 (e.g. sbx_live_...)
 */
export function generateDeviceKey(): string {
  return `sbx_live_${crypto.randomBytes(16).toString("hex")}`;
}

/**
 * Generates a cryptographically random, unguessable alphanumeric device ID like BOX_7K4M9Q
 */
export function generateSecureDeviceId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(6);
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return `BOX_${code}`;
}

/**
 * Computes a cryptographic SHA-256 hash of a hardware provisioning key.
 */
export function hashDeviceKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey.trim()).digest("hex");
}

/**
 * Constant-time verification of an incoming hardware key against the stored SHA-256 hash,
 * with zero-downtime backward compatibility for legacy plaintext keys.
 */
export function verifyDeviceKey(
  providedKey: string,
  storedHash?: string | null,
  legacyPlaintext?: string | null
): { valid: boolean; needsMigration: boolean } {
  if (!providedKey || typeof providedKey !== "string") {
    return { valid: false, needsMigration: false };
  }

  const cleanProvided = providedKey.trim();

  // 1. Primary check: verify against stored SHA-256 hash
  if (storedHash && typeof storedHash === "string") {
    const computedHash = hashDeviceKey(cleanProvided);
    const computedBuf = Buffer.from(computedHash);
    const storedBuf = Buffer.from(storedHash.trim());

    if (computedBuf.length === storedBuf.length && crypto.timingSafeEqual(computedBuf, storedBuf)) {
      return { valid: true, needsMigration: false };
    }
  }

  // 2. Fallback check: verify legacy plaintext key for zero-downtime auto-upgrade
  if (legacyPlaintext && typeof legacyPlaintext === "string") {
    const providedBuf = Buffer.from(cleanProvided);
    const legacyBuf = Buffer.from(legacyPlaintext.trim());

    if (providedBuf.length === legacyBuf.length && crypto.timingSafeEqual(providedBuf, legacyBuf)) {
      return { valid: true, needsMigration: true };
    }
  }

  return { valid: false, needsMigration: false };
}

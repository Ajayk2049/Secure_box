import * as argon2 from "argon2";
import bcrypt from "bcrypt";

/**
 * Rules.md Section 22.1 Parameter Baseline:
 * Minimum params: memoryCost 19MB (19456 KB), timeCost 2, parallelism 1.
 */
const ARGON2_OPTIONS: argon2.HashOptions = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

/**
 * Hashes a plaintext password using Argon2id.
 */
export async function hashPassword(password: string): Promise<string> {
  return await argon2.hash(password, { ...ARGON2_OPTIONS, raw: false });
}

export interface PasswordVerifyResult {
  valid: boolean;
  needsRehash: boolean;
}

/**
 * Verifies a password against a hash with transparent backward compatibility:
 * - If the hash is an Argon2 hash, verify with argon2.
 * - If the hash is a legacy bcrypt hash ($2a$, $2b$, $2y$), verify with bcrypt and signal `needsRehash: true`.
 * - If the hash is legacy plaintext, verify directly and signal `needsRehash: true`.
 */
export async function verifyPassword(password: string, hash: string): Promise<PasswordVerifyResult> {
  if (!hash || !password) {
    return { valid: false, needsRehash: false };
  }

  // 1. Argon2 hash check
  if (hash.startsWith("$argon2")) {
    try {
      const valid = await argon2.verify(hash, password);
      return { valid, needsRehash: false };
    } catch {
      return { valid: false, needsRehash: false };
    }
  }

  // 2. Legacy Bcrypt hash check ($2a$, $2b$, $2y$)
  if (/^\$2[aby]\$/.test(hash)) {
    try {
      const valid = await bcrypt.compare(password, hash);
      return { valid, needsRehash: valid };
    } catch {
      return { valid: false, needsRehash: false };
    }
  }

  // 3. Reject any unhashed or unknown password formats
  return { valid: false, needsRehash: false };
}

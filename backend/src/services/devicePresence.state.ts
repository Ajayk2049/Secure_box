/**
 * Phase 1 — pure presence state machine.
 *
 * Deliberately dependency-free (no config, no mongoose, no socket): the whole
 * decision can therefore be exercised by `backend/scripts/verify-presence.ts`
 * without booting the server or requiring a .env file.
 *
 * A device is `offline` only when no frame of any kind has been observed for
 * `offlineMs`. `suspect` is an internal-only state that keeps a device visible
 * as online while the confirmation deadline counts down. Nothing outside the
 * backend process ever sees `suspect`.
 */

export type PresenceState = "online" | "suspect" | "offline";

export interface PresenceTiming {
  /** Silence after which the device becomes unconfirmed (invisible internally). */
  suspectMs: number;
  /** Silence after which the device is confirmed offline and published. */
  offlineMs: number;
  /** Number of consecutive confirmation ticks required before declaring offline (default 2). */
  requiredOfflineTicks?: number;
}

export interface PresenceInput {
  previous: PresenceState;
  /** True when a hardware socket is currently registered for this device. */
  socketOpen: boolean;
  /** Age of the last observed frame, in ms. `null` means "never observed". */
  lastSeenAgeMs: number | null;
  /** Number of consecutive ticks the device has been observed exceeding the offline threshold. */
  consecutiveOfflineTicks?: number;
}

/**
 * State is a pure function of elapsed silence and confirmation ticks. A socket that exists but is
 * silent is *not* proof of life, which is the defect this replaces.
 */
export function nextPresenceState(input: PresenceInput, timing: PresenceTiming): PresenceState {
  const { previous, socketOpen, lastSeenAgeMs, consecutiveOfflineTicks } = input;

  if (lastSeenAgeMs === null || !Number.isFinite(lastSeenAgeMs)) {
    // No evidence at all. A socket without a single frame is not enough.
    if (previous === "offline") return "offline";
    return socketOpen ? "suspect" : "offline";
  }

  const requiredTicks = timing.requiredOfflineTicks ?? 1;
  const ticks = consecutiveOfflineTicks ?? requiredTicks;

  if (lastSeenAgeMs >= timing.offlineMs) {
    if (ticks >= requiredTicks) {
      return "offline";
    }
    return "suspect";
  }

  if (lastSeenAgeMs < timing.suspectMs) return "online";
  return "suspect";
}

/** `suspect` is reported as online everywhere outside this module. */
export function isPresenceVisibleOnline(state: PresenceState): boolean {
  return state !== "offline";
}

/** Milliseconds left before the silence becomes a confirmed offline. */
export function msUntilConfirmedOffline(lastSeenAgeMs: number, timing: PresenceTiming): number {
  if (!Number.isFinite(lastSeenAgeMs)) return 0;
  return Math.max(0, timing.offlineMs - lastSeenAgeMs);
}

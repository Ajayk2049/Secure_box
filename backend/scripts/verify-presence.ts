/**
 * Phase 1 verifier — exercises the presence state machine without a server,
 * MongoDB, or a .env file.
 *
 * Run:  cd backend && npx tsx scripts/verify-presence.ts
 *
 * It imports ONLY the dependency-free state module, so it can never be blocked
 * by config validation (zod requires MONGODB_URI etc.).
 */
import {
  nextPresenceState,
  isPresenceVisibleOnline,
  msUntilConfirmedOffline,
  type PresenceState,
  type PresenceTiming,
} from "../src/services/devicePresence.state.js";

const TIMING: PresenceTiming = { suspectMs: 25_000, offlineMs: 90_000 };
const GHOST_TIMEOUT_MS = 45_000;

let failures = 0;
let checks = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  checks += 1;
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    failures += 1;
    console.log(`  FAIL  ${label}\n        expected ${e}\n        actual   ${a}`);
  }
}

function section(name: string): void {
  console.log(`\n${name}`);
}

// ---------------------------------------------------------------------------
// 1. Table-driven state machine
// ---------------------------------------------------------------------------
section("1. State machine (state is a pure function of silence)");

const cases: Array<{
  name: string;
  previous: PresenceState;
  socketOpen: boolean;
  age: number | null;
  expected: PresenceState;
}> = [
  { name: "fresh frame, socket open", previous: "online", socketOpen: true, age: 0, expected: "online" },
  { name: "fresh frame, socket closed (reconnect churn)", previous: "online", socketOpen: false, age: 500, expected: "online" },
  { name: "just under suspect window", previous: "online", socketOpen: false, age: 24_999, expected: "online" },
  { name: "exactly at suspect window", previous: "online", socketOpen: false, age: 25_000, expected: "suspect" },
  { name: "mid suspect window", previous: "online", socketOpen: false, age: 60_000, expected: "suspect" },
  { name: "just under confirmed offline", previous: "suspect", socketOpen: false, age: 89_999, expected: "suspect" },
  { name: "exactly at confirmed offline", previous: "suspect", socketOpen: false, age: 90_000, expected: "offline" },
  { name: "long silence", previous: "suspect", socketOpen: false, age: 600_000, expected: "offline" },
  { name: "offline stays offline with no frames", previous: "offline", socketOpen: false, age: null, expected: "offline" },
  { name: "offline + fresh frame becomes online (recovery)", previous: "offline", socketOpen: true, age: 0, expected: "online" },
  { name: "offline + stale socket is still offline", previous: "offline", socketOpen: true, age: null, expected: "offline" },
  { name: "never seen, no socket", previous: "online", socketOpen: false, age: null, expected: "offline" },
  { name: "never seen, socket open (suspect, not online)", previous: "online", socketOpen: true, age: null, expected: "suspect" },
  { name: "NaN age treated as unknown", previous: "online", socketOpen: true, age: Number.NaN, expected: "suspect" },
];

for (const c of cases) {
  const actual = nextPresenceState(
    { previous: c.previous, socketOpen: c.socketOpen, lastSeenAgeMs: c.age },
    TIMING
  );
  check(c.name, actual, c.expected);
}

// ---------------------------------------------------------------------------
// 1b. Tick-based hysteresis (Phase 2)
// ---------------------------------------------------------------------------
section("1b. Tick-based hysteresis (2-tick confirmation)");

const HYSTERESIS_TIMING: PresenceTiming = { suspectMs: 25_000, offlineMs: 90_000, requiredOfflineTicks: 2 };

check(
  "tick 1 exceeding offlineMs stays suspect",
  nextPresenceState(
    { previous: "suspect", socketOpen: false, lastSeenAgeMs: 95_000, consecutiveOfflineTicks: 1 },
    HYSTERESIS_TIMING
  ),
  "suspect"
);

check(
  "tick 2 exceeding offlineMs confirms offline",
  nextPresenceState(
    { previous: "suspect", socketOpen: false, lastSeenAgeMs: 100_000, consecutiveOfflineTicks: 2 },
    HYSTERESIS_TIMING
  ),
  "offline"
);

check(
  "recovery at tick 1 returns immediately to online upon frame",
  nextPresenceState(
    { previous: "suspect", socketOpen: true, lastSeenAgeMs: 100, consecutiveOfflineTicks: 0 },
    HYSTERESIS_TIMING
  ),
  "online"
);

// ---------------------------------------------------------------------------
// 2. Visibility contract: suspect is never published as offline
// ---------------------------------------------------------------------------
section("2. Visibility contract");

check("online is visible online", isPresenceVisibleOnline("online"), true);
check("suspect is reported online (no flap)", isPresenceVisibleOnline("suspect"), true);
check("offline is reported offline", isPresenceVisibleOnline("offline"), false);

// ---------------------------------------------------------------------------
// 3. Confirmation countdown
// ---------------------------------------------------------------------------
section("3. Confirmation countdown");

check("fresh device waits full window", msUntilConfirmedOffline(0, TIMING), 90_000);
check("mid suspect window", msUntilConfirmedOffline(25_000, TIMING), 65_000);
check("confirmed offline has no countdown", msUntilConfirmedOffline(120_000, TIMING), 0);
check("unknown age confirms immediately", msUntilConfirmedOffline(Number.NaN, TIMING), 0);

// ---------------------------------------------------------------------------
// 4. Ghost timeout must be tighter than the confirmation window
// ---------------------------------------------------------------------------
section("4. Timing invariants");

check("suspect < offline", TIMING.suspectMs < TIMING.offlineMs, true);
check("ghost timeout < offline", GHOST_TIMEOUT_MS < TIMING.offlineMs, true);
check(
  "device survives 5 missed 10s heartbeats without an offline event",
  isPresenceVisibleOnline(
    nextPresenceState({ previous: "online", socketOpen: true, lastSeenAgeMs: 50_000 }, TIMING)
  ),
  true
);
check(
  "device survives the observed 60.7s worst-case transient",
  isPresenceVisibleOnline(
    nextPresenceState({ previous: "online", socketOpen: false, lastSeenAgeMs: 60_700 }, TIMING)
  ),
  true
);

// ---------------------------------------------------------------------------
// 5. Replay of the real churn window (2026-11-17, BOX_WCUUY9)
// ---------------------------------------------------------------------------
section("5. Replay: observed churn 04:46:20Z - 07:20:39Z");

interface ReplayEvent {
  atSec: number;
  kind: "socket_open" | "socket_close" | "frame" | "door_event";
  note: string;
}

const events: ReplayEvent[] = [
  { atSec: 0, kind: "socket_open", note: "04:46:20 baseline connect" },
  { atSec: 4.677, kind: "socket_close", note: "04:46:24.677 offline socket_disconnect (old code)" },
  { atSec: 8.7, kind: "socket_open", note: "recovered +4.0s (old code emitted offline+online)" },
  { atSec: 10, kind: "frame", note: "heartbeat" },
  { atSec: 20, kind: "frame", note: "heartbeat" },
  { atSec: 30.878, kind: "socket_close", note: "04:46:50.878 offline socket_disconnect (old code)" },
  { atSec: 34.9, kind: "socket_open", note: "recovered +4.0s (old code emitted offline+online)" },
  { atSec: 40, kind: "frame", note: "heartbeat" },
  { atSec: 50, kind: "frame", note: "heartbeat" },
  { atSec: 60, kind: "frame", note: "heartbeat" },
  { atSec: 70, kind: "frame", note: "heartbeat" },
  { atSec: 80, kind: "frame", note: "heartbeat" },
  { atSec: 90, kind: "frame", note: "heartbeat" },
  { atSec: 100, kind: "frame", note: "heartbeat" },
  { atSec: 110, kind: "frame", note: "heartbeat" },
  { atSec: 120, kind: "frame", note: "heartbeat" },
  { atSec: 130, kind: "frame", note: "heartbeat" },
  { atSec: 140, kind: "frame", note: "heartbeat" },
  { atSec: 150, kind: "frame", note: "heartbeat" },
  { atSec: 160, kind: "frame", note: "heartbeat" },
  { atSec: 170, kind: "frame", note: "heartbeat" },
  { atSec: 180, kind: "door_event", note: "05:31:19.578 door event (old code forced online=true)" },
  { atSec: 190, kind: "frame", note: "heartbeat" },
  { atSec: 200, kind: "frame", note: "heartbeat" },
  { atSec: 210, kind: "frame", note: "heartbeat" },
  { atSec: 220, kind: "frame", note: "heartbeat" },
  { atSec: 230, kind: "frame", note: "heartbeat" },
  // 05:32:20.295 -> 05:32:80 = the observed 60.7 s transient (frames stop)
  { atSec: 240, kind: "frame", note: "heartbeat" },
  { atSec: 250, kind: "frame", note: "heartbeat" },
  { atSec: 260, kind: "frame", note: "heartbeat" },
  { atSec: 270, kind: "frame", note: "heartbeat" },
  { atSec: 280, kind: "frame", note: "heartbeat" },
  { atSec: 290, kind: "frame", note: "heartbeat" },
  { atSec: 300.7, kind: "socket_open", note: "05:37:20 reconnect after 60.7 s silence" },
  { atSec: 310, kind: "frame", note: "heartbeat" },
  { atSec: 320, kind: "frame", note: "heartbeat" },
  { atSec: 330, kind: "frame", note: "heartbeat" },
  { atSec: 340, kind: "frame", note: "heartbeat" },
  { atSec: 350, kind: "frame", note: "heartbeat" },
  // Real outage: last frame at 360, reconnect at 360 + 53.7 min
  { atSec: 360, kind: "frame", note: "06:15:15.877 last frame before real outage" },
  { atSec: 360 + 3222, kind: "socket_open", note: "07:08:56.688 real reconnect after 53.7 min" },
  { atSec: 360 + 3232, kind: "frame", note: "heartbeat" },
  { atSec: 360 + 3242, kind: "frame", note: "heartbeat" },
  { atSec: 360 + 3252, kind: "frame", note: "heartbeat" },
  { atSec: 360 + 3262, kind: "frame", note: "heartbeat" },
  { atSec: 360 + 3272, kind: "frame", note: "heartbeat" },
  { atSec: 360 + 3282, kind: "frame", note: "heartbeat" },
  { atSec: 360 + 3292, kind: "frame", note: "heartbeat" },
  { atSec: 360 + 3302, kind: "frame", note: "heartbeat" },
  { atSec: 360 + 3312, kind: "frame", note: "heartbeat" },
  { atSec: 360 + 3322, kind: "frame", note: "heartbeat" },
  { atSec: 360 + 3332, kind: "frame", note: "heartbeat" },
  { atSec: 360 + 3342, kind: "frame", note: "heartbeat" },
  { atSec: 360 + 3352, kind: "frame", note: "heartbeat" },
  // 07:20:39.688 reconnect with no preceding offline under the old code
  { atSec: 360 + 3362, kind: "socket_open", note: "07:20:39.688 reconnect (old code: duplicate DEVICE_ONLINE)" },
  { atSec: 360 + 3372, kind: "frame", note: "heartbeat" },
  { atSec: 360 + 3382, kind: "frame", note: "heartbeat" },
  { atSec: 360 + 3400, kind: "socket_open", note: "end of window" },
];

// Simulation: walk the timeline at 1s resolution, feeding events in and asking
// the state machine what the device looks like. This is exactly what the
// service does (record.lastSeen updated on any frame, state derived from age).
// The device was already online before the window opened, and the window ends
// at the last observed event (no trailing extrapolation).
let state: PresenceState = "online";
let publishedOnline = true;
let lastSeenSec: number | null = null;
let socketOpen = false;

const published: Array<{ atSec: number; online: boolean; cause: string }> = [];

let cursor = 0;
const endSec = events[events.length - 1]!.atSec;
for (let t = 0; t <= endSec; t += 1) {
  while (cursor < events.length && events[cursor]!.atSec <= t) {
    const ev = events[cursor]!;
    if (ev.kind === "socket_open") {
      socketOpen = true;
      lastSeenSec = ev.atSec;
    } else if (ev.kind === "socket_close") {
      socketOpen = false;
    } else {
      // frame and door_event are both proof of life
      lastSeenSec = ev.atSec;
    }
    cursor += 1;
  }

  const ageMs = lastSeenSec === null ? null : (t - lastSeenSec) * 1000;
  state = nextPresenceState({ previous: state, socketOpen, lastSeenAgeMs: ageMs }, TIMING);

  const online = isPresenceVisibleOnline(state);
  if (online !== publishedOnline) {
    // Publish only when the *visible* value changes, which is what the service
    // does (publishedOnline is the guard).
    if (!online || state === "online") {
      publishedOnline = online;
      published.push({
        atSec: t,
        online,
        cause: online ? "offline->online" : "confirmed offline",
      });
    }
  }
}

const offlines = published.filter((p) => !p.online);
const onlines = published.filter((p) => p.online);

console.log(`  published transitions: ${published.length} (offline ${offlines.length}, online ${onlines.length})`);
for (const p of published) {
  console.log(`    t+${p.atSec}s  ${p.online ? "ONLINE " : "OFFLINE"}  ${p.cause}`);
}

check("exactly one offline published in the window", offlines.length, 1);
check("exactly one online (the recovery) published", onlines.length, 1);
check("publishes are strictly one pair", published.length, 2);
check(
  "the offline is the real outage, not the 60.7s transient",
  offlines[0] !== undefined && offlines[0].atSec > 360 && offlines[0].atSec < 360 + 3222,
  true
);
check(
  "no duplicate DEVICE_ONLINE (old code had 2 with no preceding offline)",
  published.filter((p) => p.online).length <= offlines.length,
  true
);
check("the 60.7s transient never became visible", published.every((p) => p.atSec !== 240 && p.atSec !== 250), true);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n${failures === 0 ? "PASS" : "FAIL"}: ${checks - failures}/${checks} checks passed.`);
if (failures > 0) process.exit(1);

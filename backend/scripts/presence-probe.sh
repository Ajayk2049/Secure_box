#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Phase 0 presence probe  —  READ-ONLY, no writes, no restarts.
#
# Samples GET /devices/:id/status-debug on an interval and records every
# change in the effective online decision, so a rare flapping event can be
# read afterwards instead of being caught live.
#
# Usage:
#   API=http://127.0.0.1:7000 \
#   DEVICE=BOX_WCUUY9 \
#   IDENTIFIER='<phone-or-email>' PASSWORD='<password>' \
#   INTERVAL=2 DURATION=900 \
#   bash backend/scripts/presence-probe.sh
#
#   DURATION=0  -> run until Ctrl-C
#
# Output:
#   $OUT (default /tmp/presence-probe-<device>-<UTC>.csv)  full sample log
#   stdout                                                 only transitions
#
# Requires: curl, node (already on the VPS for this backend).
# ---------------------------------------------------------------------------
set -uo pipefail

API="${API:-http://127.0.0.1:7000}"
DEVICE="${DEVICE:-BOX_WCUUY9}"
INTERVAL="${INTERVAL:-2}"
DURATION="${DURATION:-900}"
IDENTIFIER="${IDENTIFIER:-}"
PASSWORD="${PASSWORD:-}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="${OUT:-/tmp/presence-probe-${DEVICE}-${STAMP}.csv}"
JAR="$(mktemp)"
TOKEN=""

command -v curl >/dev/null || { echo "curl not found"; exit 1; }
command -v node >/dev/null || { echo "node not found"; exit 1; }
[ -n "$IDENTIFIER" ] && [ -n "$PASSWORD" ] || { echo "IDENTIFIER and PASSWORD are required"; exit 1; }

# One JSON payload, parsed with node. Never evaluates shell.
read -r -d '' PARSE_JS <<'JS'
let raw = "";
process.stdin.on("data", d => raw += d).on("end", () => {
  let j;
  try { j = JSON.parse(raw); } catch { console.log("PARSE_ERROR\t" + raw.slice(0, 160).replace(/\s+/g, " ")); return; }
  if (j.error) { console.log("HTTP_ERROR\t" + String(j.error).replace(/\s+/g, " ")); return; }
  const s = j.status || {};
  const sock = s.socket || {};
  const db = s.db || {};
  const incs = (s.inconsistencies || []).join("|");
  console.log([
    new Date().toISOString(),
    s.effectiveOnline,
    s.decisionPath,
    sock.state,
    sock.isFresh,
    sock.lastActivityAgeMs,
    db.online,
    db.lastHeartbeatAgeMs,
    incs,
  ].join("\t"));
});
JS

login() {
  local resp body
  resp="$(curl -s -c "$JAR" -X POST "$API/api/auth/login" \
    -H 'Content-Type: application/json' \
    -d "$(node -e 'console.log(JSON.stringify({identifier:process.argv[1],password:process.argv[2]}))' "$IDENTIFIER" "$PASSWORD")")"
  # Non-admin login returns the JWT in the body; admin login only sets a cookie.
  TOKEN="$(printf '%s' "$resp" | node -e 'let r="";process.stdin.on("data",d=>r+=d).on("end",()=>{try{console.log(JSON.parse(r).token||"")}catch{console.log("")}})')"
  if [ -n "$TOKEN" ]; then
    echo "[probe] logged in (bearer token)"
  elif grep -q admin_token "$JAR" 2>/dev/null; then
    echo "[probe] logged in (admin cookie)"
  else
    body="$(printf '%s' "$resp" | head -c 300)"
    echo "[probe] LOGIN FAILED: $body"
    exit 1
  fi
}

fetch() {
  if [ -n "$TOKEN" ]; then
    curl -s -H "Authorization: Bearer $TOKEN" "$API/api/devices/$DEVICE/status-debug?windowHours=${1:-1}"
  else
    curl -s -b "$JAR" "$API/api/devices/$DEVICE/status-debug?windowHours=${1:-1}"
  fi
}

login

echo "[probe] device=$DEVICE api=$API interval=${INTERVAL}s duration=${DURATION}s"
echo "[probe] csv=$OUT"

# Baseline: thresholds actually loaded by the running process + churn history.
echo "----- thresholds (what this build really loaded) -----"
fetch 24 | node -e '
let r="";process.stdin.on("data",d=>r+=d).on("end",()=>{
  let j;try{j=JSON.parse(r)}catch{console.log("  unreadable response: "+r.slice(0,200));return}
  const t=(j.status&&j.status.thresholds)||{};
  console.log("  socketFreshnessMs = "+(t.socketFreshnessMs??"?"));
  console.log("  suspectMs         = "+(t.suspectMs??"?"));
  console.log("  offlineMs         = "+(t.offlineMs??"?"));
  console.log("  persistMs         = "+(t.persistMs??"?"));
  console.log("  restartFallbackMs = "+(t.restartFallbackMs??"?"));
  console.log("  ghostTimeoutMs    = "+(t.ghostTimeoutMs??"?"));
  console.log("  offlineGraceMs    = "+(t.offlineGraceMs??"?"));
  const p=j.presence;
  if (p) {
    console.log("----- presence authority -----");
    console.log("  tracked="+(p.tracked??"?")+" online="+(p.online??"?")+" suspect="+(p.suspect??"?")+" offline="+(p.offline??"?")+" flusher="+(p.flusherActive??"?"));
    console.log("  stats="+JSON.stringify(p.stats??{}));
  }
  const h=j.history||{};
  console.log("----- churn history, last "+(h.windowHours??"?")+"h -----");
  console.log("  reconnects (device_online) = "+((h.counts&&h.counts.online)??"?"));
  console.log("  reconnectsPerHour = "+(h.reconnectsPerHour??"?"));
  console.log("  offline via socket close = "+((h.counts&&h.counts.offlineSocket)??"?"));
  console.log("  offline via watchdog     = "+((h.counts&&h.counts.offlineWatchdog)??"?"));
  console.log("  offline, other           = "+((h.counts&&h.counts.offlineOther)??"?"));
});
'

printf 'timestamp\teffectiveOnline\tdecisionPath\tsocketState\tsocketFresh\tsocketAgeMs\tdbOnline\tdbHeartbeatAgeMs\tinconsistencies\n' > "$OUT"

prev=""
start=$(date +%s)
samples=0
transitions=0
offlineSeen=0

while :; do
  now=$(date +%s)
  elapsed=$((now - start))
  if [ "$DURATION" -gt 0 ] && [ "$elapsed" -ge "$DURATION" ]; then break; fi

  line="$(fetch 1 | node -e "$PARSE_JS")"
  samples=$((samples + 1))
  printf '%s\n' "$line" >> "$OUT"

  key="$(printf '%s' "$line" | cut -f2-5,9)"

  if [ "$key" != "$prev" ]; then
    transitions=$((transitions + 1))
    echo ">>> $(printf '%s' "$line" | awk -F'\t' '{
      printf "%-24s online=%-5s path=%-22s socket=%-8s fresh=%-5s sockAge=%-7s dbOnline=%-5s dbHbAge=%-8s incs=%s", $1,$2,$3,$4,$5,$6,$7,$8,$9 }')"
    prev="$key"
  fi

  case "$(printf '%s' "$line" | cut -f2)" in
    false) offlineSeen=$((offlineSeen + 1)) ;;
  esac

  sleep "$INTERVAL"
done

echo "----- probe summary -----"
echo "  samples      = $samples"
echo "  transitions  = $transitions"
echo "  offline reads= $offlineSeen"
echo "  csv          = $OUT"
echo
echo "Interpretation cheat-sheet:"
echo "  path=offline while socket.state=OPEN  -> RAM/socket truth and DB truth disagree (Defect B)"
echo "  socketFresh=true but dbHeartbeatAgeMs keeps rising without ever resetting -> Defect A (heartbeat never persisted)"
echo "  path flips socket_fresh -> offline -> socket_fresh inside one outage -> the flap the user reports"
echo "  inconsistencies non-empty at any sample -> direct proof, quote that CSV row"

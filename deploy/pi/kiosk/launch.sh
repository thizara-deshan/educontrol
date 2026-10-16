#!/usr/bin/env bash
# Chromium kiosk for the Pi's own screen (ARCHITECTURE §9, Q13). Started by the desktop user's labwc
# autostart (deploy/pi/kiosk/labwc-autostart). Waits until core-api answers, then runs Chromium full
# screen and restarts it whenever it exits. Output: ~/.cache/eduscope-kiosk.log.
set -u

URL=${EDUSCOPE_KIOSK_URL:-http://localhost}
LOG=${XDG_CACHE_HOME:-$HOME/.cache}/eduscope-kiosk.log
PROFILE=${XDG_CONFIG_HOME:-$HOME/.config}/eduscope-kiosk
# D-27: the UI is laid out for a 1280×800 viewport (SPEC §2.1); R-101's panel is 1920×1200, so 1.5.
# Set EDUSCOPE_KIOSK_SCALE=1 for a 1280×800 panel.
SCALE=${EDUSCOPE_KIOSK_SCALE:-1.5}
mkdir -p "$(dirname "$LOG")" "$PROFILE"

log() { printf '%s %s\n' "$(date -Is)" "$*" >>"$LOG"; }

# Keep one old log; Chromium can be chatty.
if [[ -f $LOG ]] && (($(stat -c %s "$LOG") > 5000000)); then mv -f "$LOG" "$LOG.1"; fi

# One launcher per session (labwc autostart runs again after a compositor restart).
exec 9>"$PROFILE/launch.lock"
if ! flock -n 9; then
  log "another launch.sh is running; exiting"
  exit 0
fi

# The package is `chromium` on Debian 13 images and `chromium-browser` on older Bookworm ones.
BROWSER=$(command -v chromium || command -v chromium-browser || true)
if [[ -z $BROWSER ]]; then
  log "no chromium or chromium-browser on PATH; kiosk not started"
  exit 1
fi

# Chromium's error page does not retry by itself; the SPA does (H1/H2) once it has loaded.
log "waiting for $URL/api/health"
until curl -fsS -m 2 -o /dev/null "$URL/api/health"; do sleep 2; done

while true; do
  # A killed Chromium offers "Restore pages?" on the next start; record the last exit as clean.
  sed -i -e 's/"exited_cleanly":false/"exited_cleanly":true/' -e 's/"exit_type":"[^"]*"/"exit_type":"Normal"/' \
    "$PROFILE/Default/Preferences" 2>/dev/null
  log "starting $BROWSER $URL"
  # Flags: ARCHITECTURE §9, plus a private profile, no first-run UI and no keyring prompt (PLAN-M10 D5),
  # plus the D-27 scale factor.
  "$BROWSER" \
    --kiosk \
    --force-device-scale-factor="$SCALE" \
    --noerrdialogs \
    --disable-infobars \
    --disable-pinch \
    --overscroll-history-navigation=0 \
    --check-for-update-interval=31536000 \
    --no-first-run \
    --password-store=basic \
    --user-data-dir="$PROFILE" \
    "$URL" >>"$LOG" 2>&1
  log "chromium exited with status $?; restarting in 2 s"
  sleep 2
done

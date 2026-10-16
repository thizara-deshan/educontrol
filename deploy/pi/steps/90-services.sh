# shellcheck shell=bash
# install.sh step 90: systemd units (ARCHITECTURE §9, D-23). Restarts eduscope.target only when this
# run changed something, so a second run leaves the running services alone (M10 AC1).

unit_tmp=$(mktemp)
units_changed=0
for unit in eduscope.target eduscope-hw.service eduscope-core.service eduscope-restart.path eduscope-restart.service; do
  render "$HERE/systemd/$unit" "REPO=$REPO" >"$unit_tmp"
  install_if_changed "$unit_tmp" "/etc/systemd/system/$unit" 644 root root
  if ((EDUSCOPE_CHANGED)); then units_changed=1; fi
done
rm -f "$unit_tmp"
if ((units_changed)); then systemctl daemon-reload; fi

for unit in eduscope.target eduscope-hw.service eduscope-core.service eduscope-restart.path; do
  if ! systemctl is-enabled -q "$unit"; then
    systemctl enable "$unit"
    changed "enabled $unit"
  fi
done
if ! systemctl is-active -q eduscope-restart.path; then
  systemctl start eduscope-restart.path
  changed "started eduscope-restart.path"
fi

services_restarted=0
if ((EDUSCOPE_CHANGES > 0)) || ! systemctl is-active -q eduscope.target; then
  systemctl restart eduscope.target
  services_restarted=1
  log "restarted eduscope.target"
fi

log "waiting for core-api on port 80"
for _ in $(seq 1 30); do
  if curl -fsS -m 2 -o /dev/null http://127.0.0.1/api/health; then break; fi
  sleep 1
done
curl -fsS -m 2 http://127.0.0.1/api/health >/dev/null ||
  die "core-api does not answer on port 80: journalctl -u eduscope-core -u eduscope-hw -b"
log "core-api is up: http://$ROOM_HOSTNAME.local"

# A running kiosk keeps the page (and JS bundle) it loaded before the restart. Stop its Chromium once
# core-api answers; deploy/pi/kiosk/launch.sh starts it again on the new build within 2 s. Runs with or
# without --kiosk, so a plain update run also refreshes the room screen. The oldest matching process is
# the browser itself (its zygotes and renderers carry the same --user-data-dir).
if ((services_restarted)); then
  kiosk_pid=$(pgrep -o -f -- '--user-data-dir=[^ ]*/eduscope-kiosk( |$)' || true)
  if [[ -n $kiosk_pid ]]; then
    kill "$kiosk_pid" || true
    log "reloaded the kiosk browser"
  fi
fi

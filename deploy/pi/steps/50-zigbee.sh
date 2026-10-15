# shellcheck shell=bash
# install.sh step 50: mosquitto, the coordinator udev link and zigbee2mqtt (H01, INTAKE-01 §5C).
# Safe on top of the hand install on R-101: /opt/zigbee2mqtt/data/ (network key, paired devices) is
# never written, except configuration.yaml when it does not exist yet.

# mosquitto: broker on 127.0.0.1:1883 only.
zigbee_missing=()
for pkg in mosquitto mosquitto-clients; do
  if ! dpkg-query -W -f='${db:Status-Abbrev}' "$pkg" 2>/dev/null | grep -q '^ii'; then zigbee_missing+=("$pkg"); fi
done
if ((${#zigbee_missing[@]} > 0)); then
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends "${zigbee_missing[@]}"
  changed "installed ${zigbee_missing[*]}"
fi
install_if_changed "$HERE/zigbee/eduscope-local.conf" /etc/mosquitto/conf.d/eduscope-local.conf 644 root root
mosquitto_restart=$EDUSCOPE_CHANGED
if ! systemctl is-enabled -q mosquitto; then
  systemctl enable mosquitto
  changed "enabled mosquitto"
fi
if ((mosquitto_restart)) || ! systemctl is-active -q mosquitto; then
  systemctl restart mosquitto
  log "restarted mosquitto"
fi

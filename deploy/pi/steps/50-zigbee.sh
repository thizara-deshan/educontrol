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

# /dev/zigbee-coord for the coordinator (new installs use it; R-101's live config keeps its by-id path).
install_if_changed "$HERE/zigbee/99-eduscope-zigbee.rules" /etc/udev/rules.d/99-eduscope-zigbee.rules 644 root root
if ((EDUSCOPE_CHANGED)); then
  udevadm control --reload
  udevadm trigger --subsystem-match=tty --action=add
fi

# zigbee2mqtt: the pinned release, cloned and built as the service user. An install of another
# version is never touched: the run stops (upgrading is a manual step, README §10).
Z2M_DIR=/opt/zigbee2mqtt
Z2M_VERSION=2.14.2
if [[ ! -e $Z2M_DIR ]]; then
  git clone --depth 1 --branch "$Z2M_VERSION" https://github.com/Koenkk/zigbee2mqtt.git "$Z2M_DIR"
  chown -R "$SERVICE_USER:$SERVICE_USER" "$Z2M_DIR"
  changed "cloned zigbee2mqtt $Z2M_VERSION into $Z2M_DIR"
fi
z2m_version=$(sed -n 's/^ *"version": *"\([^"]*\)".*/\1/p' "$Z2M_DIR/package.json" | head -n 1)
[[ $z2m_version == "$Z2M_VERSION" ]] ||
  die "$Z2M_DIR has zigbee2mqtt '$z2m_version', this installer pins $Z2M_VERSION; upgrade it by hand (deploy/pi/README.md §10)"
if [[ ! -f $Z2M_DIR/dist/controller.js ]]; then
  z2m_home=$(getent passwd "$SERVICE_USER" | cut -d: -f6)
  log "building zigbee2mqtt $Z2M_VERSION as $SERVICE_USER"
  (cd "$Z2M_DIR" && runuser -u "$SERVICE_USER" -- env -i HOME="$z2m_home" PATH=/usr/bin:/bin LANG=C.UTF-8 CI=true \
    pnpm install --frozen-lockfile)
  (cd "$Z2M_DIR" && runuser -u "$SERVICE_USER" -- env -i HOME="$z2m_home" PATH=/usr/bin:/bin LANG=C.UTF-8 CI=true \
    pnpm run build)
  changed "built zigbee2mqtt $Z2M_VERSION"
fi
# Only when missing: the live file holds the network key and the paired devices' names.
if [[ ! -e $Z2M_DIR/data/configuration.yaml ]]; then
  install_if_changed "$HERE/zigbee/configuration.yaml" "$Z2M_DIR/data/configuration.yaml" 600 "$SERVICE_USER" "$SERVICE_USER"
fi

# The only zigbee2mqtt on this Pi (a second copy breaks the coordinator, INTAKE-01 Observed).
install_if_changed "$HERE/systemd/zigbee2mqtt.service" /etc/systemd/system/zigbee2mqtt.service 644 root root
z2m_restart=$EDUSCOPE_CHANGED
if ((z2m_restart)); then systemctl daemon-reload; fi
if ! systemctl is-enabled -q zigbee2mqtt; then
  systemctl enable zigbee2mqtt
  changed "enabled zigbee2mqtt"
fi
if ((z2m_restart)) || ! systemctl is-active -q zigbee2mqtt; then
  systemctl restart zigbee2mqtt
  log "restarted zigbee2mqtt"
fi

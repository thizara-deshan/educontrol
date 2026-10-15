# shellcheck shell=bash
# install.sh step 20: service user, directories, env files, journald, hostname + mDNS.

# On R-101 the eduscope account already exists as the desktop login user; it is reused (D-22).
if ! id -u "$SERVICE_USER" >/dev/null 2>&1; then
  useradd --system --user-group --home-dir "$STATE_DIR" --no-create-home --shell /usr/sbin/nologin "$SERVICE_USER"
  changed "created system user $SERVICE_USER"
fi
for group in dialout gpio audio; do
  getent group "$group" >/dev/null || die "group '$group' does not exist (expected on Raspberry Pi OS)"
  if ! id -nG "$SERVICE_USER" | tr ' ' '\n' | grep -qx "$group"; then
    usermod -aG "$group" "$SERVICE_USER"
    changed "added $SERVICE_USER to group $group"
  fi
done

# SQLite + WAL (ProtectSystem=strict allows writes only here) and the restart request file (D-23).
if [[ $(stat -c '%a %U %G' "$STATE_DIR" 2>/dev/null || true) != "750 $SERVICE_USER $SERVICE_USER" ]]; then
  install -d -m 750 -o "$SERVICE_USER" -g "$SERVICE_USER" "$STATE_DIR"
  changed "prepared $STATE_DIR"
fi
if [[ $(stat -c '%a %U %G' "$CONF_DIR" 2>/dev/null || true) != "755 root root" ]]; then
  install -d -m 755 -o root -g root "$CONF_DIR"
  changed "prepared $CONF_DIR"
fi
# systemd reads EnvironmentFile= as root, so root:root 600 is enough.
ensure_env_file "$HERE/env/core.env.example" "$CONF_DIR/core.env" root root
ensure_env_file "$HERE/env/hw.env.example" "$CONF_DIR/hw.env" root root

# Persistent journal, capped at 200 MB (ARCHITECTURE §9).
install_if_changed "$HERE/journald/eduscope.conf" /etc/systemd/journald.conf.d/eduscope.conf 644 root root
if ((EDUSCOPE_CHANGED)); then
  install -d -m 2755 -o root -g systemd-journal /var/log/journal
  systemd-tmpfiles --create --prefix /var/log/journal
  systemctl restart systemd-journald
fi

# Hostname (avahi publishes <hostname>.local).
hostname_changed=0
if [[ $(hostnamectl hostname --static 2>/dev/null || cat /etc/hostname) != "$ROOM_HOSTNAME" ]]; then
  hostnamectl set-hostname "$ROOM_HOSTNAME"
  hostname_changed=1
  changed "hostname set to $ROOM_HOSTNAME"
fi
if ! grep -qE "^127\.0\.1\.1[[:space:]]+$ROOM_HOSTNAME\$" /etc/hosts; then
  if grep -qE '^127\.0\.1\.1[[:space:]]' /etc/hosts; then
    sed -i -E "s/^127\.0\.1\.1[[:space:]].*/127.0.1.1\t$ROOM_HOSTNAME/" /etc/hosts
  else
    printf '127.0.1.1\t%s\n' "$ROOM_HOSTNAME" >>/etc/hosts
  fi
  changed "/etc/hosts: 127.0.1.1 is $ROOM_HOSTNAME"
fi
if ! systemctl is-enabled -q avahi-daemon; then
  systemctl enable avahi-daemon
  changed "enabled avahi-daemon"
fi
if ((hostname_changed)) || ! systemctl is-active -q avahi-daemon; then
  systemctl restart avahi-daemon
  log "restarted avahi-daemon"
fi

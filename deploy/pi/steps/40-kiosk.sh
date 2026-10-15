# shellcheck shell=bash
# install.sh step 40 (--kiosk only): Chromium kiosk for the desktop user who ran sudo (ARCHITECTURE §9).

if ((KIOSK)); then
  kiosk_user=${SUDO_USER:-}
  [[ -n $kiosk_user && $kiosk_user != root ]] ||
    die "--kiosk installs for the desktop user: run 'sudo deploy/pi/install.sh --kiosk' from that user's account"
  kiosk_home=$(getent passwd "$kiosk_user" | cut -d: -f6)
  labwc_dir=$kiosk_home/.config/labwc
  kiosk_changes_before=$EDUSCOPE_CHANGES

  if ! command -v chromium >/dev/null && ! command -v chromium-browser >/dev/null; then
    apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get install -y chromium
    changed "installed chromium"
  fi

  # Boot to the desktop, logged in as the kiosk user (raspi-config B4 = desktop autologin as SUDO_USER).
  if ! grep -qx "autologin-user=$kiosk_user" /etc/lightdm/lightdm.conf 2>/dev/null ||
    [[ $(systemctl get-default) != graphical.target ]]; then
    SUDO_USER=$kiosk_user raspi-config nonint do_boot_behaviour B4
    changed "desktop autologin as $kiosk_user"
  fi

  # The app dims and blanks itself (D-16, H23): no OS blanking. Same edit as `raspi-config nonint
  # do_blanking 1` under labwc (raspi-config do_blanking), but also when no labwc session is running.
  for file in "$labwc_dir/autostart" /etc/xdg/labwc/autostart /etc/xdg/labwc-greeter/autostart; do
    if [[ -f $file ]] && grep -q swayidle "$file"; then
      sed -i '/swayidle/d' "$file"
      changed "OS screen blanking removed from $file"
    fi
  done

  runuser -u "$kiosk_user" -- mkdir -p "$labwc_dir"
  [[ -f $labwc_dir/autostart ]] || runuser -u "$kiosk_user" -- touch "$labwc_dir/autostart"
  ensure_line "$labwc_dir/autostart" "$(render "$HERE/kiosk/labwc-autostart" "REPO=$REPO")"

  if ((EDUSCOPE_CHANGES > kiosk_changes_before)); then
    log "kiosk configured for $kiosk_user: reboot to start it (sudo reboot)"
  fi
fi

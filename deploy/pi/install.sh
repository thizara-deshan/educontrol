#!/usr/bin/env bash
# Eduscope Central installer for the room Raspberry Pi (M10; ARCHITECTURE §9; D-22, D-23).
#
#   sudo deploy/pi/install.sh            services only (headless Pi)
#   sudo deploy/pi/install.sh --kiosk    also the Chromium kiosk for the user who ran sudo
#
# Idempotent: after `git pull`, run it again. A run that changes nothing ends with "No changes."
set -euo pipefail

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO=$(cd "$HERE/../.." && pwd)
# shellcheck source=lib.sh
. "$HERE/lib.sh"

KIOSK=0
for arg in "$@"; do
  case $arg in
  --kiosk) KIOSK=1 ;;
  *) die "unknown option '$arg' (usage: sudo deploy/pi/install.sh [--kiosk])" ;;
  esac
done

[[ $EUID -eq 0 ]] || die "run it as root: sudo deploy/pi/install.sh"
[[ $REPO =~ ^[A-Za-z0-9/._-]+$ ]] || die "checkout path '$REPO' may contain only letters, digits and / . _ -"

# Settings used by the steps (sourced below, in file-name order).
SERVICE_USER=eduscope
ROOM_HOSTNAME=r-101
STATE_DIR=/var/lib/eduscope
CONF_DIR=/etc/eduscope
NODE_MAJOR=24
UV_VERSION=0.13.1
UV_SHA256_AARCH64=9041c73c99fdc5892cf128140beb354eca9231d502068cc36e6cb53a8e59ad14
BUILD_USER=$(stat -c %U "$REPO")
[[ $BUILD_USER != root ]] || die "$REPO belongs to root; clone it as a normal user"

for step in "$HERE"/steps/[0-9][0-9]-*.sh; do
  # shellcheck source=/dev/null
  . "$step"
done

if ((EDUSCOPE_CHANGES == 0)); then
  log "No changes."
else
  log "$EDUSCOPE_CHANGES change(s) applied."
fi

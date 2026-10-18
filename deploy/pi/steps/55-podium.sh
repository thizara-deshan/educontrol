# shellcheck shell=bash
# install.sh step 55: the /dev/podium-mcu udev link for the podium MCU (H06, PLAN-H06 T5).
# hw-service opens it when HW_DRIVERS has audio=real or hdmi=real (HW_PODIUM_PORT).

install_if_changed "$HERE/podium/99-eduscope-podium.rules" /etc/udev/rules.d/99-eduscope-podium.rules 644 root root
if ((EDUSCOPE_CHANGED)); then
  udevadm control --reload
  udevadm trigger --subsystem-match=tty --action=add
fi

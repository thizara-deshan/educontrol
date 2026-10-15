#!/usr/bin/env bash
# Tests for deploy/pi/lib.sh. Runs as a normal user in a temp dir; `pnpm pi:test` runs it.
set -euo pipefail
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=../lib.sh
. "$HERE/../lib.sh"

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
ME=$(id -un)
MYGROUP=$(id -gn)
FAILS=0
check() { # check NAME ACTUAL EXPECTED
  if [[ $2 == "$3" ]]; then
    printf 'ok   %s\n' "$1"
  else
    printf 'FAIL %s: got [%s], want [%s]\n' "$1" "$2" "$3"
    FAILS=$((FAILS + 1))
  fi
}

# install_if_changed
printf 'a\n' >"$TMP/src"
install_if_changed "$TMP/src" "$TMP/out/dest" 644 "$ME" "$MYGROUP" >/dev/null
check "install_if_changed writes a new file" "$EDUSCOPE_CHANGED $(cat "$TMP/out/dest")" "1 a"
install_if_changed "$TMP/src" "$TMP/out/dest" 644 "$ME" "$MYGROUP" >/dev/null
check "install_if_changed leaves an identical file alone" "$EDUSCOPE_CHANGED" "0"
install_if_changed "$TMP/src" "$TMP/out/dest" 600 "$ME" "$MYGROUP" >/dev/null
check "install_if_changed fixes the mode" "$EDUSCOPE_CHANGED $(stat -c %a "$TMP/out/dest")" "1 600"
printf 'b\n' >"$TMP/src"
install_if_changed "$TMP/src" "$TMP/out/dest" 600 "$ME" "$MYGROUP" >/dev/null
check "install_if_changed replaces new content" "$EDUSCOPE_CHANGED $(cat "$TMP/out/dest")" "1 b"
check "every change is counted" "$EDUSCOPE_CHANGES" "3"

# render
printf 'ExecStart=@REPO@/x @REPO@/y\nKeep=@OTHER@\n' >"$TMP/tpl"
check "render replaces every placeholder" "$(render "$TMP/tpl" REPO=/opt/e)" "$(printf 'ExecStart=/opt/e/x /opt/e/y\nKeep=@OTHER@')"
check "render refuses a value with |" "$( (render "$TMP/tpl" 'REPO=/a|b' 2>&1) || true)" "install.sh: render: the value for REPO contains '|'"

# ensure_line
ensure_line "$TMP/autostart" "line one" >/dev/null
ensure_line "$TMP/autostart" "line one" >/dev/null
check "ensure_line appends once" "$EDUSCOPE_CHANGED $(grep -c 'line one' "$TMP/autostart")" "0 1"

# random values
check "random_hex 32 gives 64 hex chars" "$(random_hex 32 | grep -cxE '[0-9a-f]{64}')" "1"

# ensure_env_file
printf 'COOKIE_SECRET=@COOKIE_SECRET@\nINITIAL_ROOM_PIN=1234\n' >"$TMP/core.example"
ensure_env_file "$TMP/core.example" "$TMP/etc/core.env" "$ME" "$MYGROUP" >/dev/null
check "ensure_env_file creates mode 600" "$EDUSCOPE_CHANGED $(stat -c %a "$TMP/etc/core.env")" "1 600"
check "ensure_env_file generates the secret" "$(grep -cxE 'COOKIE_SECRET=[0-9a-f]{64}' "$TMP/etc/core.env")" "1"
BEFORE=$(sha256sum "$TMP/etc/core.env")
ensure_env_file "$TMP/core.example" "$TMP/etc/core.env" "$ME" "$MYGROUP" >/dev/null
check "ensure_env_file never rewrites an existing file" "$EDUSCOPE_CHANGED $(sha256sum "$TMP/etc/core.env")" "0 $BEFORE"

# tree_hash
mkdir -p "$TMP/dist/assets"
printf 'x' >"$TMP/dist/index.html"
printf 'y' >"$TMP/dist/assets/a.js"
H1=$(tree_hash "$TMP/dist")
touch "$TMP/dist/index.html"
check "tree_hash ignores mtimes" "$(tree_hash "$TMP/dist")" "$H1"
printf 'z' >"$TMP/dist/assets/a.js"
check "tree_hash sees content changes" "$([[ $(tree_hash "$TMP/dist") != "$H1" ]] && echo differs)" "differs"
check "tree_hash of a missing dir is empty" "$(tree_hash "$TMP/nope")" ""

if ((FAILS > 0)); then
  printf '%d failed\n' "$FAILS"
  exit 1
fi
printf 'all lib.sh tests passed\n'

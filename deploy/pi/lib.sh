# shellcheck shell=bash
# Helpers for deploy/pi/install.sh (PLAN-M10). Sourced, never run. Every helper is idempotent, always
# returns 0 (install.sh runs under `set -e`) and reports what it did in two variables:
#   EDUSCOPE_CHANGED  1 when the last helper call changed something, else 0
#   EDUSCOPE_CHANGES  total number of changes this run (M10 AC1: a second run ends with 0)
# Tested without root by deploy/pi/test/test-lib.sh.

EDUSCOPE_CHANGED=0
EDUSCOPE_CHANGES=0

log() { printf '==> %s\n' "$*"; }
die() {
  printf 'install.sh: %s\n' "$*" >&2
  exit 1
}
# changed MESSAGE — records one change and logs it.
changed() {
  EDUSCOPE_CHANGED=1
  EDUSCOPE_CHANGES=$((EDUSCOPE_CHANGES + 1))
  log "$*"
}

# install_if_changed SRC DEST MODE OWNER GROUP — writes DEST only when content, mode or owner differ.
install_if_changed() {
  local src=$1 dest=$2 mode=$3 owner=$4 group=$5
  EDUSCOPE_CHANGED=0
  if [[ -f $dest ]] && cmp -s "$src" "$dest" &&
    [[ $(stat -c '%a %U %G' "$dest") == "$mode $owner $group" ]]; then
    return 0
  fi
  install -D -m "$mode" -o "$owner" -g "$group" "$src" "$dest"
  changed "wrote $dest"
}

# render TEMPLATE KEY=VALUE... — prints TEMPLATE with every @KEY@ replaced by VALUE.
render() {
  local template=$1 pair key value
  local args=()
  shift
  for pair in "$@"; do
    key=${pair%%=*}
    value=${pair#*=}
    [[ $value != *'|'* ]] || die "render: the value for $key contains '|'"
    args+=(-e "s|@${key}@|${value}|g")
  done
  sed "${args[@]}" "$template"
}

# ensure_line FILE LINE — appends LINE unless FILE already has that exact line; creates FILE.
ensure_line() {
  local file=$1 line=$2
  EDUSCOPE_CHANGED=0
  if [[ -f $file ]] && grep -qxF -- "$line" "$file"; then return 0; fi
  printf '%s\n' "$line" >>"$file"
  changed "added to $file: $line"
}

# random_hex BYTES — prints 2×BYTES lowercase hex characters from /dev/urandom.
random_hex() { od -An -N"$1" -tx1 /dev/urandom | tr -d ' \n'; }

# ensure_env_file EXAMPLE DEST OWNER GROUP — creates DEST (mode 600) from EXAMPLE with a fresh
# @COOKIE_SECRET@ (64 hex chars). An existing DEST is never read or changed. (The first PINs are fixed in
# core.env.example, D-24.)
ensure_env_file() {
  local example=$1 dest=$2 owner=$3 group=$4 tmp
  EDUSCOPE_CHANGED=0
  if [[ -e $dest ]]; then return 0; fi
  tmp=$(mktemp)
  render "$example" "COOKIE_SECRET=$(random_hex 32)" >"$tmp"
  install -D -m 600 -o "$owner" -g "$group" "$tmp" "$dest"
  rm -f "$tmp"
  changed "created $dest"
}

# tree_hash DIR — prints one sha256 over every file path and content below DIR ("" if DIR is missing).
tree_hash() {
  if [[ ! -d $1 ]]; then return 0; fi
  (cd "$1" && find . -type f -print0 | LC_ALL=C sort -z | xargs -0 -r sha256sum | sha256sum | cut -d' ' -f1)
}

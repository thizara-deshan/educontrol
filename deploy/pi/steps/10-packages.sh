# shellcheck shell=bash
# install.sh step 10: apt prerequisites, Node 24 from NodeSource, pnpm, uv (D-22).

apt_missing=()
for pkg in build-essential python3 avahi-daemon curl ca-certificates gpg git; do
  if ! dpkg-query -W -f='${db:Status-Abbrev}' "$pkg" 2>/dev/null | grep -q '^ii'; then apt_missing+=("$pkg"); fi
done
if ((${#apt_missing[@]} > 0)); then
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends "${apt_missing[@]}"
  changed "installed ${apt_missing[*]}"
fi

# Node.js from NodeSource. Debian 13's own nodejs 20 segfaults loading better-sqlite3 (D-22).
nodesource_key=/etc/apt/keyrings/nodesource.gpg
if [[ ! -s $nodesource_key ]]; then
  install -d -m 755 /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor --yes -o "$nodesource_key"
  chmod 644 "$nodesource_key"
  changed "added the NodeSource apt key"
fi
apt_tmp=$(mktemp)
printf 'Types: deb\nURIs: https://deb.nodesource.com/node_%s.x\nSuites: nodistro\nComponents: main\nSigned-By: %s\n' \
  "$NODE_MAJOR" "$nodesource_key" >"$apt_tmp"
install_if_changed "$apt_tmp" /etc/apt/sources.list.d/nodesource.sources 644 root root
printf 'Package: nodejs\nPin: origin deb.nodesource.com\nPin-Priority: 600\n' >"$apt_tmp"
install_if_changed "$apt_tmp" /etc/apt/preferences.d/nodesource 644 root root
rm -f "$apt_tmp"

node_version=$(dpkg-query -W -f='${Version}' nodejs 2>/dev/null || true)
if [[ $node_version != "$NODE_MAJOR".*nodesource* ]]; then
  if [[ -n $node_version && $node_version != *nodesource* ]]; then
    # Debian's node-corepack owns /usr/bin/corepack, which NodeSource's nodejs also ships.
    mapfile -t debian_node < <(dpkg-query -W -f='${db:Status-Abbrev} ${Package}\n' nodejs node-corepack 'libnode*' 2>/dev/null |
      awk '$1 == "ii" { print $2 }')
    log "removing Debian's Node.js packages: ${debian_node[*]}"
    DEBIAN_FRONTEND=noninteractive apt-get purge -y "${debian_node[@]}"
  fi
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
  changed "installed Node.js $(/usr/bin/node --version) from NodeSource"
fi

# pnpm: the exact version from package.json "packageManager".
pnpm_version=$(sed -n 's/.*"packageManager": *"pnpm@\([^"]*\)".*/\1/p' "$REPO/package.json")
[[ -n $pnpm_version ]] || die "package.json has no \"packageManager\": \"pnpm@…\""
if [[ $(cd / && /usr/bin/pnpm --version 2>/dev/null || true) != "$pnpm_version" ]]; then
  # Purging Debian's node-corepack leaves dangling links that make `npm -g` fail with EEXIST (Blocker 2).
  for link in /usr/bin/pnpm /usr/bin/pnpx; do
    if [[ -L $link && ! -e $link ]]; then
      rm -f "$link"
      changed "removed dangling $link"
    fi
  done
  npm install -g --no-fund --no-audit "pnpm@$pnpm_version"
  changed "installed pnpm $pnpm_version"
fi

# uv: pinned release, checksum-verified, into /usr/local/bin.
if [[ $(/usr/local/bin/uv --version 2>/dev/null || true) != "uv $UV_VERSION "* ]]; then
  [[ $(uname -m) == aarch64 ]] || die "uv is pinned for aarch64 (Raspberry Pi 5) only; this machine is $(uname -m)"
  uv_tmp=$(mktemp -d)
  curl -fsSL -o "$uv_tmp/uv.tar.gz" \
    "https://github.com/astral-sh/uv/releases/download/$UV_VERSION/uv-aarch64-unknown-linux-gnu.tar.gz"
  echo "$UV_SHA256_AARCH64  $uv_tmp/uv.tar.gz" | sha256sum -c --quiet -
  tar -xzf "$uv_tmp/uv.tar.gz" -C "$uv_tmp"
  install -m 755 "$uv_tmp/uv-aarch64-unknown-linux-gnu/uv" "$uv_tmp/uv-aarch64-unknown-linux-gnu/uvx" /usr/local/bin/
  rm -rf "$uv_tmp"
  changed "installed uv $UV_VERSION"
fi

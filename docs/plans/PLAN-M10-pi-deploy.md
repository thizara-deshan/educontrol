# PLAN-M10 — Pi deploy
Milestone: `docs/milestones/M10-pi-deploy.md` · Start tag: `m10-start` · Verify-all: `pnpm verify`

Inputs read for this plan: M10; ARCHITECTURE §1 (deploy layout), §2, §5 (D-09 kiosk = loopback), §6.1, §9, §10;
SPEC §2.6 (kiosk), H1–H4, H23, R15, S3e, Q13 (no screen changes in this milestone); CLAUDE.md; decision records D-20, D-21;
INTAKE-01 (platform observations, CR-D) and H01 (it depends on M10's system Node); PLAN-M09 (D12 restart, format);
`apps/core-api/src/{config,main,paths}.ts`, `system/{restart,info}.ts`, `plugins/{static,auth,origin-check}.ts`,
`domain/session-rules.ts`, `routes/system.ts`, `db/seed.ts`, `scripts/build.ts`, `package.json`; `services/hw/app/config.py`,
`registry.py`, `pyproject.toml`, `.python-version`; root `package.json`, `pnpm-workspace.yaml`, `.gitignore`; the kiosk's
`ConnectionBanner.tsx`, `features/kiosk/*` (dim/blank already exist) and `features/settings/devices/PinsCard.tsx`.
**No UI work:** every screen exists; `reference/screens/` was not needed. The live Pi was inspected for this plan
(Debian 13 trixie, Pi 5, labwc 0.20.2, Chromium 154, systemd 257, raspi-config, NodeSource and uv release files).

## Executor notes (read once, apply to every task)

- Repo root: `/home/eduscope/edcontrol` on the **R-101 Pi** (this milestone's machine). "Run `cmd`" = from the repo root.
- **Platform (user decision): Debian 13 "trixie" and Node 24.** M10's text says Bookworm and Node 22; wherever they
  disagree, this plan (and D-22, written in T1) wins. Never install or target Node 22.
- Before T1: `git tag m10-start` (on the commit that adds this plan).
- Apply blocks **verbatim**:
  - "Create `X`" = the block is the full file content (end it with one newline); create missing folders.
  - "Patch `X`" = run the shell block from the repo root exactly as given. `git apply` prints nothing on success. If it
    prints `error: patch failed`, **stop** and write a Blocker. Never hand-edit around a failed patch.
- Executable files: after creating `deploy/pi/install.sh` (T7) and `deploy/pi/kiosk/launch.sh` (T11) run `chmod +x` on
  them; `git ls-files -s <file>` must show mode `100755` after `git add`.
- **What was verified while writing this plan** (in a scratch worktree on this Pi): every shell file passes
  `pnpm pi:lint` (shellcheck 0.11.0) and `bash -n`; `deploy/pi/test/test-lib.sh` (15 checks, after D-24) and the `labwc_rc.py`
  unittests (7) pass; the T4 vitest (3) and pytest (4) pass with typecheck, eslint and ruff clean; all five units pass
  `systemd-analyze verify`; `install.sh` refuses unknown options and non-root runs; `pnpm build` + `node
  apps/core-api/dist/main.js` (Node 24, `KIOSK_DIST`, `LOCALHOST_IS_KIOSK=true`) serves the SPA with history fallback, and
  `curl http://localhost:<port>/api/session` answers `"client_type":"kiosk"` with core bound to `0.0.0.0`.
  **Not verified (needs root or the screen):** every apt/NodeSource/useradd/systemctl step, the units running under
  systemd, the restart path unit, reboot, and the kiosk on the display. Those are the `[ON PI · HUMAN]` steps.
- **`[ON PI · HUMAN]` steps need root.** You (the executor) have no sudo password. At such a step, stop and ask the
  human to type the given command with the `!` prefix in the Claude Code prompt (e.g. `! sudo deploy/pi/install.sh`),
  then read its output and continue. If nobody answers, write a Blocker and stop. Never try to work around sudo.
- `pnpm verify` gains `pnpm pi:lint` (shellcheck via `uvx`, needs network the first time) and `pnpm pi:test` in T3.
  Test-count changes: core-api **+3** and hw **+4** (T4); nothing else changes in the TS/Python suites.
- **While eduscope.target runs (from T10), `pnpm dev` cannot start** (hw-service already owns 127.0.0.1:8081). Not
  needed in this milestone; if you need it: `! sudo systemctl stop eduscope.target` first.
- After each task: run its **Verify**, then `pnpm verify`; tick the task box in this file; commit with the task's
  message (one commit per task, plan file included).

### Decisions this plan makes (do not re-open them)

- **D1 — Platform** (record **D-22**, T1): Pi 5 + Raspberry Pi OS on Debian 13 trixie; system Node = **Node 24 from
  NodeSource** at `/usr/bin/node`. Debian's own `nodejs` 20.19.2 is purged first: it **segfaults** loading better-sqlite3's
  prebuilt binary (exit 139, observed on this Pi), and its `node-corepack` package owns `/usr/bin/corepack`, which
  NodeSource's package also ships (dpkg would refuse). pnpm = exact `packageManager` version via `npm -g`; uv = 0.13.1
  tarball, sha256-checked. hw unit runs `.venv/bin/uvicorn` (not `uv run`, which syncs a venv that
  `ProtectSystem=strict` makes read-only). better-sqlite3 uses its shipped prebuilt (`allowBuilds: false`); the
  build tools are installed anyway, as M10 asks.
- **D2 — Restart controller** (record **D-23**, T2): `NoNewPrivileges` makes `sudo` refuse to run (checked on this Pi:
  `setpriv --no-new-privs sudo -n true` → `The "no new privileges" flag is set…`). So **no sudoers line**:
  `RESTART_COMMAND=/usr/bin/touch /var/lib/eduscope/restart.request`, `eduscope-restart.path` → `eduscope-restart.service`
  (root) → `systemctl --no-block restart eduscope.target`; both services `PartOf=eduscope.target`. core-api code is unchanged.
- **D3 — Service user.** On R-101 `eduscope` already exists (uid 1000, the desktop login user): reuse it and only add
  groups. Elsewhere create a system user. The checkout stays where it was cloned; builds run as its owner; install.sh
  checks the service user can read the build and run the venv.
- **D4 — Env files** `/etc/eduscope/{core,hw}.env`: root:root 600 (systemd reads them as root), created once from
  `deploy/pi/env/*.example`, never rewritten. The cookie secret (64 hex) is
  generated at creation. **D-24 (supersedes the random-PIN part of D4):** the first PINs are fixed, room `1234` and
  technician `123456`, written in `core.env.example`; change them in the app after the demo. `KIOSK_DIST` is set in
  the core unit (it contains the checkout path, which the unit template already knows).
- **D5 — Kiosk browser.** Flags from ARCHITECTURE §9 plus `--no-first-run`, `--password-store=basic` (no keyring prompt at
  autologin) and a private `--user-data-dir`. The launcher waits for `GET /api/health` before the first start (Chromium's
  error page never retries; the loaded SPA does, H1/H2), clears the "Restore pages?" crash flag before each start, and
  restarts Chromium 2 s after it exits. It takes a lock so labwc can't start it twice.
- **D6 — No cursor** `[ASSUMED]`: labwc 0.20 has no "hide cursor" setting, but window rules can run actions on map. A user
  `rc.xml` rule for `identifier="chromium*"` runs `WarpCursor` (bottom-right) + `HideCursor`; a mouse movement shows the
  pointer again (useful for a technician with a mouse). Raspberry Pi OS starts labwc with `--merge-config`, so the user file
  only adds this rule. Chromium's Wayland app_id is assumed to match `chromium*` — checked in T13 on the screen.
- **D7 — OS blanking off.** `raspi-config`'s own check (`get_blanking`) only works while labwc runs (`is_labwc` =
  `pgrep labwc`), so install.sh deletes `swayidle` lines from the user and system labwc autostart files itself — the same
  edit `raspi-config nonint do_blanking 1` makes under labwc.
- **D8 — "A second run changes nothing" (AC1)** means: no file under `/etc` or `/var/lib/eduscope` is rewritten, no unit is
  enabled, the services are **not restarted**, and the run ends with `No changes.` It still runs `pnpm install`,
  `pnpm build` and `uv sync` (no-ops); a stamp over lockfiles + build output decides whether the build changed.
- **D9 — Bind addresses unchanged:** core on `0.0.0.0:80` (IPv4, as AC4 says), hw on `127.0.0.1:8081`. Browsers that try
  `::1` / an AAAA record first fall back to IPv4 (checked with `curl http://localhost`).
- **D10 — Hostname.** `r-101` replaces this Pi's current hostname `eduscope`: after T8, `eduscope.local` stops resolving
  (use `r-101.local` or the IP for SSH).
- **D11 — Tests for deploy code:** `deploy/pi/test/test-lib.sh` (bash, no root) and `deploy/pi/kiosk/test_labwc_rc.py`
  (stdlib unittest) run in `pnpm pi:test`; shellcheck runs in `pnpm pi:lint`; both are part of `pnpm verify`. The env
  examples are cross-checked against the real config schemas by one vitest (core-api) and one pytest (hw).

## File map

| File | Create/Modify | Responsibility |
|---|---|---|
| `docs/decisions/D-22-pi-platform.md` | Create | platform record, closes CR-D (T1) |
| `docs/decisions/D-23-restart-path-unit.md` | Create | restart without sudo (T2) |
| `deploy/pi/lib.sh` | Create | idempotent helpers: change counting, install-if-changed, render, env files, tree hash (T3) |
| `deploy/pi/test/test-lib.sh` | Create | lib.sh tests, no root (T3) |
| `deploy/pi/.shellcheckrc` | Create | shellcheck settings for sourced files (T3) |
| `package.json` | Modify | `pi:lint`, `pi:test`, `verify` (T3, T12) |
| `deploy/pi/env/core.env.example`, `deploy/pi/env/hw.env.example` | Create | env templates (T4) |
| `apps/core-api/test/deploy/core-env-example.test.ts` | Create | core.env.example is a valid config (T4) |
| `services/hw/tests/test_deploy_env.py` | Create | hw.env.example is valid and all-fake (T4) |
| `deploy/pi/systemd/eduscope.target`, `eduscope-hw.service`, `eduscope-core.service` | Create | units (T5) |
| `deploy/pi/systemd/eduscope-restart.path`, `eduscope-restart.service` | Create | restart request (T6) |
| `deploy/pi/install.sh`, `deploy/pi/steps/10-packages.sh` | Create | entry point; apt, Node 24, pnpm, uv (T7) |
| `deploy/pi/steps/20-system.sh`, `deploy/pi/journald/eduscope.conf` | Create | user, dirs, env, journald, hostname (T8) |
| `deploy/pi/steps/30-build.sh` | Create | build as checkout owner, build stamp (T9) |
| `deploy/pi/steps/90-services.sh` | Create | install/enable units, restart on change, health wait (T10) |
| `deploy/pi/kiosk/launch.sh`, `deploy/pi/kiosk/labwc-autostart` | Create | Chromium kiosk launcher (T11) |
| `deploy/pi/kiosk/labwc_rc.py`, `deploy/pi/kiosk/test_labwc_rc.py` | Create | hide-cursor window rule (T12) |
| `deploy/pi/steps/40-kiosk.sh` | Create | `--kiosk`: autologin, blanking, autostart, rc.xml (T13) |
| `deploy/pi/README.md` | Create | install, update, logs, PINs (T14) |
| this plan | Modify | ticks, Blockers |

Order: decisions → shared helpers + test harness → env templates (with contract tests) → units → install steps in run
order → kiosk → README → acceptance. Install steps are separate files sourced by `install.sh` in name order, so each task
adds one complete file and the installer works (and is re-run) after every install task.

## Tasks

### T1 — Decision record D-22: platform (Debian 13, Pi 5, Node 24)
- [x] done

**Files:** `docs/decisions/D-22-pi-platform.md`

**Context:** INTAKE-01 CR-D ("Platform: Debian 13 trixie, Pi 5, Node 24 — before M10 is planned"). CLAUDE.md: changing a
decision needs a record in `docs/decisions/`; ARCHITECTURE and the milestone files are never edited. Format: copy D-21.

**Do:**
1. Create `docs/decisions/D-22-pi-platform.md`:
````markdown
# D-22 — Pi platform: Debian 13 "trixie", Raspberry Pi 5, Node 24 from NodeSource

Date: 2026-10-15 · Milestone: M10 · Closes: INTAKE-01 change record CR-D · Supersedes: ARCHITECTURE §2
"node 22" and §9 "Bookworm"; M10 scope "Node 22 + pnpm", "Bookworm" (AC1), "`uv run uvicorn`" (§9).

## Context

ARCHITECTURE and M10 were written for Raspberry Pi OS Bookworm with Node 22. The R-101 Pi (INTAKE-01,
observed) runs Raspberry Pi OS based on **Debian 13 trixie** on a **Raspberry Pi 5** (aarch64, labwc
0.20 started with `--merge-config`, Chromium package `chromium`, Python 3.13, systemd 257). Development on
the Pi uses Node v24.22.0 from nvm, and its desktop login user is already called `eduscope` (uid 1000).

Observed on the R-101 Pi on 2026-10-15:
- Debian's `nodejs` 20.19.2 (`/usr/bin/node`) **segfaults** (exit 139) when it loads better-sqlite3 13's
  prebuilt `linux-arm64.node`; the same binary works under Node 24.22.0.
- NodeSource's `nodejs` 24 ships `/usr/bin/corepack`, which Debian's `node-corepack` package also owns,
  so it cannot be installed over Debian's Node without removing that first.
- Under `ProtectSystem=strict` the checkout is read-only, and `uv run` syncs the venv before it starts.

## Decision

1. Target platform: Raspberry Pi 5, 64-bit Raspberry Pi OS on Debian 13 trixie. Bookworm is not supported.
2. System Node: **Node 24 from NodeSource** (`deb.nodesource.com/node_24.x`, suite `nodistro`, pinned
   with priority 600) at `/usr/bin/node`. install.sh purges Debian's `nodejs`, `node-corepack` and
   `libnode*` first. nvm stays a developer tool; units never use it.
3. pnpm: the exact `packageManager` version from the root `package.json`, installed with `npm -g`.
   uv: release 0.13.1 for aarch64, checksum-verified, in `/usr/local/bin`.
4. `eduscope-hw.service` runs `services/hw/.venv/bin/uvicorn` directly (same command line as
   `uv run uvicorn …`, without the sync step).
5. The services run from the checkout where it was cloned; install.sh builds as the checkout's owner.
   The service user is the existing `eduscope` account when there is one (on R-101: the desktop user),
   otherwise a new system user.
6. `engines.node` (`>=22`), `@types/node` and the esbuild target (`node22`) stay as they are: the
   output runs unchanged on Node 24.

## Consequences

- Any other package that depended on Debian's `nodejs` is removed with it (none on R-101 besides
  `nodejs-doc` / `node-acorn`); zigbee2mqtt keeps its own nvm Node until H01 moves it to `/usr/bin/node`.
- On R-101 the service user is also a sudo-capable login user. The units still drop every privilege
  (`NoNewPrivileges`, empty or minimal capability sets), so sudo is unusable from the services.
````

**Verify:** `pnpm verify` green (no code changed).

**Commit:** `git commit -m "docs: D-22 Pi platform (Debian 13 trixie, Pi 5, Node 24)"`

---

### T2 — Decision record D-23: restart through a path unit
- [x] done

**Files:** `docs/decisions/D-23-restart-path-unit.md`

**Context:** ARCHITECTURE §9 wants both `NoNewPrivileges` and `sudo systemctl restart …` from core-api; they exclude each
other (Decision D2 above). S3e's route and `createRestart` (`apps/core-api/src/system/restart.ts`) stay unchanged: only
the configured command changes.

**Do:**
1. Create `docs/decisions/D-23-restart-path-unit.md`:
````markdown
# D-23 — "Restart controller" goes through a systemd path unit, not sudo

Date: 2026-10-15 · Milestone: M10 · Supersedes: ARCHITECTURE §9 "runs `sudo systemctl restart
eduscope.target` via a single-command sudoers entry for `eduscope`", §1 install.sh "sudoers line", and
M10 scope "sudoers line …" and "`RESTART_COMMAND=sudo systemctl restart eduscope.target`".

## Context

ARCHITECTURE §9 hardens `eduscope-core.service` with `NoNewPrivileges` and
`CapabilityBoundingSet=CAP_NET_BIND_SERVICE`, and also wants S3e "Restart controller" to run
`sudo systemctl restart eduscope.target`. Both cannot hold: with the no-new-privileges flag set, sudo
refuses to run (checked on the R-101 Pi: `setpriv --no-new-privs sudo -n true` →
`sudo: The "no new privileges" flag is set, which prevents sudo from running as root.`), and the
bounding set has no `CAP_SETUID` either.

## Decision

1. `RESTART_COMMAND=/usr/bin/touch /var/lib/eduscope/restart.request` (core-api's `createRestart`
   is unchanged; the file is inside its only writable path).
2. `eduscope-restart.path` (`PathChanged=/var/lib/eduscope/restart.request`, enabled at boot) starts
   `eduscope-restart.service`, a root oneshot outside core-api's cgroup that runs
   `systemctl --no-block restart eduscope.target`.
3. Both services are `PartOf=eduscope.target`, so restarting the target restarts them.
4. No sudoers entry is installed.

Rejected: dropping `NoNewPrivileges` and the bounding set (weaker sandbox for the LAN-facing process);
a polkit rule for `eduscope` (needs polkitd and a JavaScript rule, harder to test, wider than one unit).

## Consequences

- Anything that can write `/var/lib/eduscope` (the `eduscope` user, root) can restart the services —
  the same principal the sudoers line would have allowed.
- Dev keeps `RESTART_COMMAND='touch src/main.ts'` (M09 D12).
````

**Verify:** `pnpm verify` green.

**Commit:** `git commit -m "docs: D-23 restart controller via systemd path unit"`

---

### T3 — Install helpers (`lib.sh`) with tests, wired into `pnpm verify`
- [x] done

**Files:** `deploy/pi/lib.sh`, `deploy/pi/test/test-lib.sh`, `deploy/pi/.shellcheckrc`, `package.json`

**Context:** every install step must be idempotent and must say whether it changed anything (AC1, Decision D8). All
helpers return 0 (install.sh runs with `set -euo pipefail`) and report through `EDUSCOPE_CHANGED` (last call) and
`EDUSCOPE_CHANGES` (whole run). `ensure_env_file` implements Decision D4 (cookie secret only, D-24).

**Do:**
1. Create `deploy/pi/lib.sh`:
```bash
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
```
2. Create `deploy/pi/.shellcheckrc`:
```
# shellcheck config for deploy/pi (PLAN-M10). install.sh sources lib.sh and steps/*.sh, so
# variables are set in one file and used in another.
external-sources=true
source-path=SCRIPTDIR
disable=SC2034,SC2154
```
3. Patch `package.json` (run from the repo root; it must print nothing):
```sh
git apply --whitespace=nowarn <<'PATCH'
diff --git a/package.json b/package.json
index 5aff34f..2938008 100644
--- a/package.json
+++ b/package.json
@@ -18,7 +18,9 @@
     "hw:check": "pnpm hw:lint && pnpm hw:test",
     "hw:lint": "uv run --directory services/hw ruff check . && uv run --directory services/hw ruff format --check .",
     "hw:test": "uv run --directory services/hw pytest -m \"not hardware\"",
-    "verify": "pnpm typecheck && pnpm lint && pnpm test && pnpm hw:check"
+    "pi:lint": "uvx --from shellcheck-py==0.11.0.1 shellcheck deploy/pi/*.sh deploy/pi/*/*.sh",
+    "pi:test": "bash deploy/pi/test/test-lib.sh",
+    "verify": "pnpm typecheck && pnpm lint && pnpm test && pnpm hw:check && pnpm pi:lint && pnpm pi:test"
   },
   "devDependencies": {
     "@eslint/js": "^10.0.1",
PATCH
```

**Test:** create `deploy/pi/test/test-lib.sh`:
```bash
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
```

**Verify:**
- `pnpm pi:lint` → exits 0, prints nothing after the pnpm header (the first run downloads shellcheck-py into uv's cache).
- `pnpm pi:test` → 15 lines starting `ok`, then `all lib.sh tests passed`.
- `pnpm verify` green.

**Commit:** `git commit -m "chore: deploy/pi install helpers with tests, shellcheck in verify"`

---

### T4 — Env templates `core.env.example` / `hw.env.example` (+ schema cross-checks)
- [x] done

**Files:** `deploy/pi/env/core.env.example`, `deploy/pi/env/hw.env.example`,
`apps/core-api/test/deploy/core-env-example.test.ts`, `services/hw/tests/test_deploy_env.py`

**Context:** ARCHITECTURE §9; keys and formats from `apps/core-api/src/config.ts` and `services/hw/app/config.py`.
`.gitignore` already ignores `deploy/pi/env/*.env`; the `.example` files are committed. Placeholder `@COOKIE_SECRET@` is filled by `ensure_env_file` (T3); the PINs are fixed (D-24). `KIOSK_DIST` is not here (Decision D4: the core unit sets it).
`RESTART_COMMAND` follows D-23. `HW_MODE=fake` with an empty `HW_DRIVERS` (D-19): H01 switches `ir` to real.

**Do:**
1. Create `deploy/pi/env/core.env.example`:
```sh
# /etc/eduscope/core.env (mode 600) — created once by deploy/pi/install.sh from
# deploy/pi/env/core.env.example; install.sh never changes it afterwards. Keys: apps/core-api/src/config.ts.
PORT=80
HOST=0.0.0.0
DB_PATH=/var/lib/eduscope/eduscope.db
HW_URL=http://127.0.0.1:8081
COOKIE_SECRET=@COOKIE_SECRET@
ROOM_ID=R-101
ROOM_HOSTNAME=r-101.local
# D-09: the Chromium kiosk on the Pi (loopback socket) is the room screen.
LOCALHOST_IS_KIOSK=true
# D-24: fixed demo PINs, used on the first boot only (empty database). Change them in Settings → Devices.
INITIAL_ROOM_PIN=1234
INITIAL_TECH_PIN=123456
# D-23: S3e "Restart controller" touches this file; eduscope-restart.path restarts eduscope.target.
RESTART_COMMAND=/usr/bin/touch /var/lib/eduscope/restart.request
```
2. Create `deploy/pi/env/hw.env.example`:
```sh
# /etc/eduscope/hw.env (mode 600) — created once by deploy/pi/install.sh from
# deploy/pi/env/hw.env.example; install.sh never changes it afterwards. Keys: services/hw/app/config.py.
HW_MODE=fake
# Per-module override (D-19), e.g. HW_DRIVERS=ir=real. Each Hxx milestone switches its own module.
HW_DRIVERS=
```

**Test:**
1. Create `apps/core-api/test/deploy/core-env-example.test.ts`:
```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config.ts";

// M10: /etc/eduscope/core.env is created from deploy/pi/env/core.env.example (placeholders filled by
// deploy/pi/lib.sh ensure_env_file). The example must stay a valid core-api environment.

const EXAMPLE = new URL("../../../../deploy/pi/env/core.env.example", import.meta.url);

/** KEY=VALUE lines of an env file; comments and blank lines skipped. */
function parseEnvFile(text: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (match?.[1] !== undefined && match[2] !== undefined) env[match[1]] = match[2];
  }
  return env;
}

function renderedExample(): Record<string, string> {
  const text = readFileSync(EXAMPLE, "utf8")
    .replace("@COOKIE_SECRET@", "a".repeat(64));
  // The unit file sets KIOSK_DIST (it holds the checkout path); install.sh fills the rest.
  return { ...parseEnvFile(text), KIOSK_DIST: "/home/eduscope/edcontrol/apps/kiosk/dist" };
}

describe("deploy/pi/env/core.env.example", () => {
  it("has only the cookie-secret placeholder", () => {
    const placeholders = readFileSync(EXAMPLE, "utf8").match(/@[A-Z_]+@/g);
    expect(placeholders).toEqual(["@COOKIE_SECRET@"]);
  });
  it("is a valid production config once rendered", () => {
    const config = loadConfig(renderedExample());
    expect(config).toMatchObject({
      PORT: 80,
      HOST: "0.0.0.0",
      DB_PATH: "/var/lib/eduscope/eduscope.db",
      HW_URL: "http://127.0.0.1:8081",
      ROOM_ID: "R-101",
      ROOM_HOSTNAME: "r-101.local",
      LOCALHOST_IS_KIOSK: true,
      INITIAL_ROOM_PIN: "1234",
      INITIAL_TECH_PIN: "123456",
      SEED_FAKE_IR_CODES: false,
    });
  });
  it("restarts through the path unit, never sudo (D-23)", () => {
    expect(loadConfig(renderedExample()).RESTART_COMMAND).toBe("/usr/bin/touch /var/lib/eduscope/restart.request");
  });
});
```
2. Create `services/hw/tests/test_deploy_env.py`:
```python
"""M10: /etc/eduscope/hw.env is created from deploy/pi/env/hw.env.example; it must stay valid."""

from pathlib import Path

import pytest

from app.config import Settings
from app.registry import driver_kinds

EXAMPLE = Path(__file__).resolve().parents[3] / "deploy" / "pi" / "env" / "hw.env.example"


def test_hw_env_example_is_all_fake_on_loopback() -> None:
    settings = Settings(_env_file=EXAMPLE)
    assert settings.mode == "fake"
    assert settings.drivers == ""
    assert settings.host == "127.0.0.1"
    assert set(driver_kinds(settings).values()) == {"fake"}


def test_hw_env_example_has_no_placeholders() -> None:
    assert "@" not in EXAMPLE.read_text(encoding="utf-8")


@pytest.mark.parametrize("line", ["HW_MODE=fake", "HW_DRIVERS="])
def test_hw_env_example_sets(line: str) -> None:
    assert line in EXAMPLE.read_text(encoding="utf-8").splitlines()
```

**Verify:**
- `pnpm --filter @eduscope/core-api exec vitest run test/deploy` → `Tests  3 passed (3)`.
- `uv run --directory services/hw pytest tests/test_deploy_env.py -q` → `4 passed`.
- `pnpm verify` green (core-api +3 tests, hw +4).

**Commit:** `git commit -m "feat(deploy): core and hw env templates checked against the config schemas"`

---

### T5 — systemd units: `eduscope.target`, `eduscope-hw.service`, `eduscope-core.service`
- [x] done

**Files:** `deploy/pi/systemd/eduscope.target`, `deploy/pi/systemd/eduscope-hw.service`,
`deploy/pi/systemd/eduscope-core.service`

**Context:** ARCHITECTURE §2 (process table) and §9; M10 notes (`ProtectSystem=strict` + `ReadWritePaths=/var/lib/eduscope`
for SQLite + WAL; units must not write to the repo). `@REPO@` is replaced by the checkout path at install time (`render`,
T3). core `Wants=`/`After=` hw but never `Requires=` (§6.7: UI served while hw is down). Both services are
`PartOf=eduscope.target` (D-23). No `ProtectHome=`: the checkout lives under `/home` and `ProtectSystem=strict` already
makes it read-only. No `MemoryDenyWriteExecute=` (V8's JIT needs W+X pages). `PYTHONDONTWRITEBYTECODE=1` because the
venv is read-only for the service.

**Do:**
1. Create `deploy/pi/systemd/eduscope.target`:
```ini
# Eduscope Central for one room (ARCHITECTURE §2, §9). `systemctl restart eduscope.target` restarts
# both services (they are PartOf= this target). Installed by deploy/pi/install.sh.
[Unit]
Description=Eduscope Central (hw-service + core-api)
Wants=eduscope-hw.service eduscope-core.service
After=network.target

[Install]
WantedBy=multi-user.target
```
2. Create `deploy/pi/systemd/eduscope-hw.service`:
```ini
# hw-service: FastAPI on 127.0.0.1:8081 only (ARCHITECTURE §2, §7, §9). Template: install.sh replaces
# @REPO@ with the checkout path. Runs the venv's uvicorn directly (D-22): `uv run` would try to sync
# the venv, which ProtectSystem=strict makes read-only.
[Unit]
Description=Eduscope hw-service (127.0.0.1:8081)
PartOf=eduscope.target
After=network.target

[Service]
Type=simple
User=eduscope
Group=eduscope
SupplementaryGroups=dialout gpio audio
WorkingDirectory=@REPO@/services/hw
EnvironmentFile=/etc/eduscope/hw.env
Environment=PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
ExecStart=@REPO@/services/hw/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8081
Restart=always
RestartSec=2
NoNewPrivileges=yes
CapabilityBoundingSet=
ProtectSystem=strict
ReadWritePaths=/var/lib/eduscope
PrivateTmp=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes
RestrictSUIDSGID=yes
LockPersonality=yes

[Install]
WantedBy=eduscope.target
```
3. Create `deploy/pi/systemd/eduscope-core.service`:
```ini
# core-api: SPA + /api + /ws on 0.0.0.0:80 as user eduscope (ARCHITECTURE §2, §6, §9). Template:
# install.sh replaces @REPO@ with the checkout path. Wants= (not Requires=) hw: the UI is served while
# hw-service is down (§6.7). No sudo from here: NoNewPrivileges blocks it, so "Restart controller"
# goes through eduscope-restart.path (D-23).
[Unit]
Description=Eduscope core-api (port 80)
PartOf=eduscope.target
Wants=eduscope-hw.service
After=network.target eduscope-hw.service

[Service]
Type=simple
User=eduscope
Group=eduscope
WorkingDirectory=@REPO@/apps/core-api
EnvironmentFile=/etc/eduscope/core.env
Environment=NODE_ENV=production KIOSK_DIST=@REPO@/apps/kiosk/dist
ExecStart=/usr/bin/node @REPO@/apps/core-api/dist/main.js
Restart=always
RestartSec=2
AmbientCapabilities=CAP_NET_BIND_SERVICE
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
NoNewPrivileges=yes
ProtectSystem=strict
ReadWritePaths=/var/lib/eduscope
PrivateTmp=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes
RestrictSUIDSGID=yes
LockPersonality=yes

[Install]
WantedBy=eduscope.target
```

**Verify:** render them for this checkout into a temp dir and let systemd check them (no root needed). `uvicorn` must exist,
so run `uv sync --directory services/hw` first if `services/hw/.venv/bin/uvicorn` is missing:
```sh
T=$(mktemp -d) && . deploy/pi/lib.sh && for f in deploy/pi/systemd/*; do render "$f" "REPO=$PWD" >"$T/$(basename "$f")"; done && (cd "$T" && systemd-analyze verify --man=no ./eduscope.target ./eduscope-hw.service ./eduscope-core.service) && echo UNITS-OK; rm -rf "$T"
```
→ prints only `UNITS-OK`. Then `pnpm verify` green.

**Commit:** `git commit -m "feat(deploy): systemd target and units for hw-service and core-api"`

---

### T6 — Restart request units: `eduscope-restart.path` / `eduscope-restart.service`
- [x] done

**Files:** `deploy/pi/systemd/eduscope-restart.path`, `deploy/pi/systemd/eduscope-restart.service`

**Context:** D-23. `PathChanged=` fires when a writer closes the file (also on creation), not merely because it exists, so
a request file left over from an earlier restart never triggers at boot. `--no-block`: the root oneshot only queues the
target restart. The service has no `[Install]` section: only the path unit starts it.

**Do:**
1. Create `deploy/pi/systemd/eduscope-restart.path`:
```ini
# S3e "Restart controller" (D-23): core-api's RESTART_COMMAND touches the request file; this path
# unit then starts eduscope-restart.service (as root, outside core-api's cgroup).
[Unit]
Description=Watch for Eduscope restart requests

[Path]
PathChanged=/var/lib/eduscope/restart.request
Unit=eduscope-restart.service

[Install]
WantedBy=multi-user.target
```
2. Create `deploy/pi/systemd/eduscope-restart.service`:
```ini
# Started only by eduscope-restart.path (D-23). --no-block: queue the restart and return.
[Unit]
Description=Restart Eduscope Central on request

[Service]
Type=oneshot
ExecStart=/usr/bin/systemctl --no-block restart eduscope.target
```

**Verify:**
```sh
T=$(mktemp -d) && . deploy/pi/lib.sh && for f in deploy/pi/systemd/*; do render "$f" "REPO=$PWD" >"$T/$(basename "$f")"; done && (cd "$T" && systemd-analyze verify --man=no ./eduscope.target ./eduscope-hw.service ./eduscope-core.service ./eduscope-restart.path ./eduscope-restart.service) && echo UNITS-OK; rm -rf "$T"
```
→ prints only `UNITS-OK`. Then `pnpm verify` green.

**Commit:** `git commit -m "feat(deploy): restart request path unit for Restart controller"`

---

### T7 — `install.sh` entry point + step 10 (apt, Node 24, pnpm, uv)
- [x] done

**Files:** `deploy/pi/install.sh`, `deploy/pi/steps/10-packages.sh`

**Context:** M10 scope bullet 2; Decision D1 / D-22. `install.sh` parses `--kiosk`, refuses non-root runs and odd checkout
paths (systemd unit paths can't hold spaces), sets the shared settings, then sources `steps/NN-*.sh` in name order.
Each step uses the T3 helpers. Step 10 only touches apt and installs into `/usr/bin` and `/usr/local/bin`.

**Do:**
1. Create `deploy/pi/install.sh`, then `chmod +x deploy/pi/install.sh`:
```bash
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
```
2. Create `deploy/pi/steps/10-packages.sh`:
```bash
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
```

**Verify:**
1. `pnpm pi:lint` exits 0; `deploy/pi/install.sh --bogus; echo $?` → `install.sh: unknown option '--bogus' (usage: sudo deploy/pi/install.sh [--kiosk])` and `1`;
   `deploy/pi/install.sh; echo $?` → `install.sh: run it as root: sudo deploy/pi/install.sh` and `1`.
2. **[ON PI · HUMAN]** `! sudo deploy/pi/install.sh` — the first run purges Debian's `nodejs`/`node-corepack`/`libnode115`,
   installs `nodejs 24.x…nodesource1`, pnpm and uv, and ends with `N change(s) applied.` Then, as the executor:
   `/usr/bin/node --version` → `v24.…`; `(cd / && /usr/bin/pnpm --version)` → `11.28.3`; `/usr/local/bin/uv --version` →
   `uv 0.13.1 (…)`; `dpkg-query -W -f='${Version}\n' nodejs` contains `nodesource`.
3. **[ON PI · HUMAN]** `! sudo deploy/pi/install.sh` again → ends with `No changes.`
4. `pnpm verify` green. If step 2 fails with a dpkg "trying to overwrite" error, write a Blocker with the full output.

**Commit:** `git commit -m "feat(deploy): install.sh with Node 24, pnpm and uv prerequisites"`

---

### T8 — Step 20: service user, directories, env files, journald, hostname
- [ ] done

**Files:** `deploy/pi/steps/20-system.sh`, `deploy/pi/journald/eduscope.conf`

**Context:** M10 scope bullet 2 (user + groups `dialout gpio audio`, `/var/lib/eduscope`, `/etc/eduscope/{core,hw}.env`
mode 600, `hostnamectl set-hostname r-101`, journald persistent `SystemMaxUse=200M`); ARCHITECTURE §9 "Hostname + mDNS"
and "Logs"; Decisions D3, D4, D10. `/etc/hosts` gets `127.0.1.1 r-101` the same way `raspi-config do_hostname` does it
(so `sudo` doesn't warn about an unknown host). avahi is restarted only when the hostname changed.

**Do:**
1. Create `deploy/pi/journald/eduscope.conf`:
```ini
# Installed by deploy/pi/install.sh (ARCHITECTURE §9): keep logs across reboots, at most 200 MB.
[Journal]
Storage=persistent
SystemMaxUse=200M
```
2. Create `deploy/pi/steps/20-system.sh`:
```bash
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
```

**Verify:**
1. `pnpm pi:lint` exits 0.
2. **[ON PI · HUMAN]** `! sudo deploy/pi/install.sh` → the log shows `created /etc/eduscope/core.env`,
   `created /etc/eduscope/hw.env`, `hostname set to r-101`, (no PIN line: the first PINs are fixed, room `1234`, technician `123456`, D-24).
3. As the executor: `hostname` → `r-101`; `stat -c '%a %U %G' /var/lib/eduscope` → `750 eduscope eduscope`;
   `id -nG eduscope` contains `dialout`, `gpio`, `audio`; `ls -l /etc/eduscope` → both files `-rw------- root root`;
   `cat /etc/systemd/journald.conf.d/eduscope.conf` shows `SystemMaxUse=200M`; `avahi-resolve -n r-101.local` (if the
   `avahi-utils` package is present) or `ping -c1 r-101.local` resolves to this Pi.
4. **[ON PI · HUMAN]** `! sudo deploy/pi/install.sh` again → `No changes.`
5. `pnpm verify` green.

**Commit:** `git commit -m "feat(deploy): service user, env files, journald and hostname step"`

---

### T9 — Step 30: build as the checkout owner
- [ ] done

**Files:** `deploy/pi/steps/30-build.sh`

**Context:** M10 scope (`pnpm install --frozen-lockfile && pnpm build`; `uv sync --frozen`) and notes ("run `pnpm build`
as the `eduscope` user or chown the result; units must not write to the repo"). The build runs as the owner of the
checkout with a clean environment (`env -i`; system Node 24 from `/usr/bin`, uv from `/usr/local/bin`, `CI=true` so pnpm
never prompts). `uv sync --frozen` keeps the dev group (pytest), because hardware tests run from this checkout on the Pi
(CLAUDE.md). The build stamp implements Decision D8. The readability checks implement Decision D3.

**Do:**
1. Create `deploy/pi/steps/30-build.sh`:
```bash
# shellcheck shell=bash
# install.sh step 30: install and build as the checkout's owner (services never write to the repo).

build_home=$(getent passwd "$BUILD_USER" | cut -d: -f6)
as_builder() {
  runuser -u "$BUILD_USER" -- env -i HOME="$build_home" PATH=/usr/local/bin:/usr/bin:/bin LANG=C.UTF-8 CI=true "$@"
}

log "building as $BUILD_USER (pnpm install, pnpm build, uv sync)"
(cd "$REPO" && as_builder pnpm install --frozen-lockfile)
(cd "$REPO" && as_builder pnpm build)
(cd "$REPO/services/hw" && as_builder uv sync --frozen)

# The services run as $SERVICE_USER: it must be able to read the build and run the venv.
for path in "$REPO/apps/core-api/dist/main.js" "$REPO/apps/kiosk/dist/index.html"; do
  runuser -u "$SERVICE_USER" -- test -r "$path" ||
    die "$SERVICE_USER cannot read $path; clone the repo where $SERVICE_USER can read it (deploy/pi/README.md)"
done
runuser -u "$SERVICE_USER" -- "$REPO/services/hw/.venv/bin/python" -c 'import uvicorn' ||
  die "$SERVICE_USER cannot run $REPO/services/hw/.venv; clone the repo where $SERVICE_USER can read it"

# One stamp over lockfiles and build output: a new stamp counts as a change (and restarts the services).
build_stamp=$(
  {
    sha256sum "$REPO/pnpm-lock.yaml" "$REPO/services/hw/uv.lock"
    tree_hash "$REPO/apps/kiosk/dist"
    tree_hash "$REPO/apps/core-api/dist"
  } | sha256sum | cut -d' ' -f1
)
if [[ $(cat "$STATE_DIR/build.stamp" 2>/dev/null || true) != "$build_stamp" ]]; then
  printf '%s\n' "$build_stamp" >"$STATE_DIR/build.stamp"
  changed "new build ${build_stamp:0:12}"
fi
```

**Verify:**
1. `pnpm pi:lint` exits 0.
2. **[ON PI · HUMAN]** `! sudo deploy/pi/install.sh` → shows `building as eduscope …`, the pnpm and vite output, and
   `new build <12 hex>`; ends with `1 change(s) applied.`
3. **[ON PI · HUMAN]** `! sudo deploy/pi/install.sh` again → `No changes.` (the stamp is unchanged).
4. `git status --short` shows nothing new besides your own task files (`dist/` and `.venv/` are git-ignored).
5. `pnpm verify` green.

**Commit:** `git commit -m "feat(deploy): build step as the checkout owner with a build stamp"`

---

### T10 — Step 90: install, enable and (re)start the services
- [ ] done

**Files:** `deploy/pi/steps/90-services.sh`

**Context:** ARCHITECTURE §9; AC1, AC2, AC4, AC5; Decision D8: the target is restarted only if this run changed something
(or it is not active), so a second run leaves running services alone. Units are rendered with `REPO` and written only
when they differ; `daemon-reload` only then. The step ends by waiting up to 30 s for `GET http://127.0.0.1/api/health`.
It is numbered 90 so the kiosk step (40, T13) runs before it.

**Do:**
1. Create `deploy/pi/steps/90-services.sh`:
```bash
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

if ((EDUSCOPE_CHANGES > 0)) || ! systemctl is-active -q eduscope.target; then
  systemctl restart eduscope.target
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
```

**Verify:**
1. `pnpm pi:lint` exits 0.
2. **[ON PI · HUMAN]** `! sudo deploy/pi/install.sh` → `wrote /etc/systemd/system/…` ×5, `enabled …` ×4,
   `restarted eduscope.target`, `core-api is up: http://r-101.local`.
3. As the executor: `systemctl is-active eduscope-core eduscope-hw eduscope-restart.path` → three `active`;
   `curl -s http://127.0.0.1/api/health` → `{"ok":true,"hw":"up",…}`; `ss -ltn | grep -E ':(80|8081) '` → `0.0.0.0:80` and
   `127.0.0.1:8081` only; `ps -o user=,args= -C node | grep core-api` → `eduscope /usr/bin/node …/apps/core-api/dist/main.js`.
4. **[ON PI · HUMAN]** `! systemctl show -p ActiveEnterTimestamp eduscope-core && sudo deploy/pi/install.sh && systemctl show -p ActiveEnterTimestamp eduscope-core`
   → `No changes.` and the same timestamp twice.
5. `pnpm verify` green.

**Commit:** `git commit -m "feat(deploy): install and enable systemd units, restart only on change"`

---

### T11 — Kiosk launcher `launch.sh` + labwc autostart line
- [ ] done

**Files:** `deploy/pi/kiosk/launch.sh`, `deploy/pi/kiosk/labwc-autostart`

**Context:** ARCHITECTURE §9 "Chromium kiosk" (flags, restart loop, `~/.cache/eduscope-kiosk.log`) and §2 "the kiosk
browser … keeps retrying until core answers"; Decision D5. The kiosk loads `http://localhost`, so core-api sees a loopback
peer and, with `LOCALHOST_IS_KIOSK=true` (T4), treats it as the kiosk (D-09: always `control`, no padlocks, no Lock
button; Settings asks for the technician PIN). `labwc-autostart` is the one line install.sh appends to the user's
`~/.config/labwc/autostart` (T13), with `@REPO@` filled in.

**Do:**
1. Create `deploy/pi/kiosk/launch.sh`, then `chmod +x deploy/pi/kiosk/launch.sh`:
```bash
#!/usr/bin/env bash
# Chromium kiosk for the Pi's own screen (ARCHITECTURE §9, Q13). Started by the desktop user's labwc
# autostart (deploy/pi/kiosk/labwc-autostart). Waits until core-api answers, then runs Chromium full
# screen and restarts it whenever it exits. Output: ~/.cache/eduscope-kiosk.log.
set -u

URL=${EDUSCOPE_KIOSK_URL:-http://localhost}
LOG=${XDG_CACHE_HOME:-$HOME/.cache}/eduscope-kiosk.log
PROFILE=${XDG_CONFIG_HOME:-$HOME/.config}/eduscope-kiosk
mkdir -p "$(dirname "$LOG")" "$PROFILE"

log() { printf '%s %s\n' "$(date -Is)" "$*" >>"$LOG"; }

# Keep one old log; Chromium can be chatty.
if [[ -f $LOG ]] && (($(stat -c %s "$LOG") > 5000000)); then mv -f "$LOG" "$LOG.1"; fi

# One launcher per session (labwc autostart runs again after a compositor restart).
exec 9>"$PROFILE/launch.lock"
if ! flock -n 9; then
  log "another launch.sh is running; exiting"
  exit 0
fi

# The package is `chromium` on Debian 13 images and `chromium-browser` on older Bookworm ones.
BROWSER=$(command -v chromium || command -v chromium-browser || true)
if [[ -z $BROWSER ]]; then
  log "no chromium or chromium-browser on PATH; kiosk not started"
  exit 1
fi

# Chromium's error page does not retry by itself; the SPA does (H1/H2) once it has loaded.
log "waiting for $URL/api/health"
until curl -fsS -m 2 -o /dev/null "$URL/api/health"; do sleep 2; done

while true; do
  # A killed Chromium offers "Restore pages?" on the next start; record the last exit as clean.
  sed -i -e 's/"exited_cleanly":false/"exited_cleanly":true/' -e 's/"exit_type":"[^"]*"/"exit_type":"Normal"/' \
    "$PROFILE/Default/Preferences" 2>/dev/null
  log "starting $BROWSER $URL"
  # Flags: ARCHITECTURE §9, plus a private profile, no first-run UI and no keyring prompt (PLAN-M10 D5).
  "$BROWSER" \
    --kiosk \
    --noerrdialogs \
    --disable-infobars \
    --disable-pinch \
    --overscroll-history-navigation=0 \
    --check-for-update-interval=31536000 \
    --no-first-run \
    --password-store=basic \
    --user-data-dir="$PROFILE" \
    "$URL" >>"$LOG" 2>&1
  log "chromium exited with status $?; restarting in 2 s"
  sleep 2
done
```
2. Create `deploy/pi/kiosk/labwc-autostart`:
```sh
@REPO@/deploy/pi/kiosk/launch.sh &
```

**Verify:**
1. `pnpm pi:lint` exits 0; `git ls-files -s deploy/pi/kiosk/launch.sh` after `git add` → `100755`.
2. Lock check without a screen: `XDG_CONFIG_HOME=$(mktemp -d) bash -c 'exec 9>"$XDG_CONFIG_HOME/l"; flock -n 9 && echo LOCK-OK'` → `LOCK-OK`
   (sanity check that `flock` exists; the real launch is checked in T13).
3. `pnpm verify` green.

**Commit:** `git commit -m "feat(deploy): Chromium kiosk launcher with restart loop"`

---

### T12 — labwc rule that hides the pointer (`labwc_rc.py`)
- [ ] done

**Files:** `deploy/pi/kiosk/labwc_rc.py`, `deploy/pi/kiosk/test_labwc_rc.py`, `package.json`

**Context:** AC7 "no cursor"; Decision D6. The helper edits the kiosk user's `~/.config/labwc/rc.xml` (it may already exist,
written by the desktop's settings tools), adds one `<windowRule identifier="chromium*">` with `WarpCursor` + `HideCursor`,
keeps everything else (comments included), and never rewrites a file that already has the rule. Python stdlib only;
it runs with the system `python3`.

**Do:**
1. Create `deploy/pi/kiosk/labwc_rc.py`:
```python
#!/usr/bin/env python3
"""Adds the Eduscope kiosk window rule to a labwc rc.xml (PLAN-M10 D6).

When a Chromium window maps, labwc moves the pointer to the bottom-right corner and hides it; it
reappears only on mouse movement, so a touch-only kiosk never shows a cursor. Raspberry Pi OS starts
labwc with --merge-config, so this user file only carries our rule and the system rc.xml still
applies. Idempotent: a file that already has the rule is not rewritten.

Usage: labwc_rc.py PATH   (prints "added" or "unchanged")
"""

import sys
import xml.etree.ElementTree as ET
from pathlib import Path

OPENBOX_NS = "http://openbox.org/3.4/rc"
RULE_IDENTIFIER = "chromium*"
ACTIONS: tuple[tuple[str, dict[str, str]], ...] = (
    ("WarpCursor", {"to": "output", "x": "-1", "y": "-1"}),
    ("HideCursor", {}),
)
EMPTY_RC = f'<?xml version="1.0" encoding="UTF-8"?>\n<openbox_config xmlns="{OPENBOX_NS}">\n</openbox_config>\n'


def _namespace(root: ET.Element) -> str:
    """'{uri}' when the root element is namespaced, else ''."""
    return root.tag[: root.tag.index("}") + 1] if root.tag.startswith("{") else ""


def has_rule(root: ET.Element) -> bool:
    ns = _namespace(root)
    for rule in root.iter(f"{ns}windowRule"):
        names = {action.get("name") for action in rule.iter(f"{ns}action")}
        if rule.get("identifier") == RULE_IDENTIFIER and "HideCursor" in names:
            return True
    return False


def add_rule(text: str) -> str | None:
    """The new file content, or None when the rule is already there."""
    ET.register_namespace("", OPENBOX_NS)
    parser = ET.XMLParser(target=ET.TreeBuilder(insert_comments=True))
    root = ET.fromstring(text, parser=parser)
    ns = _namespace(root)
    if root.tag != f"{ns}openbox_config":
        raise ValueError(f"not a labwc rc.xml: root element is {root.tag}")
    if has_rule(root):
        return None
    rules = root.find(f"{ns}windowRules")
    if rules is None:
        rules = ET.SubElement(root, f"{ns}windowRules")
    rule = ET.SubElement(rules, f"{ns}windowRule", {"identifier": RULE_IDENTIFIER})
    for name, attributes in ACTIONS:
        ET.SubElement(rule, f"{ns}action", {"name": name, **attributes})
    ET.indent(root, space="  ")
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(root, encoding="unicode") + "\n"


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("usage: labwc_rc.py PATH", file=sys.stderr)
        return 2
    path = Path(argv[1])
    current = path.read_text(encoding="utf-8") if path.exists() else EMPTY_RC
    updated = add_rule(current)
    if updated is None:
        print("unchanged")
        return 0
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(updated, encoding="utf-8")
    print("added")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
```
2. Patch `package.json` (it must print nothing):
```sh
git apply --whitespace=nowarn <<'PATCH'
diff --git a/package.json b/package.json
--- a/package.json
+++ b/package.json
@@ -19,7 +19,7 @@
     "hw:lint": "uv run --directory services/hw ruff check . && uv run --directory services/hw ruff format --check .",
     "hw:test": "uv run --directory services/hw pytest -m \"not hardware\"",
     "pi:lint": "uvx --from shellcheck-py==0.11.0.1 shellcheck deploy/pi/*.sh deploy/pi/*/*.sh",
-    "pi:test": "bash deploy/pi/test/test-lib.sh",
+    "pi:test": "bash deploy/pi/test/test-lib.sh && python3 -m unittest discover -s deploy/pi/kiosk",
     "verify": "pnpm typecheck && pnpm lint && pnpm test && pnpm hw:check && pnpm pi:lint && pnpm pi:test"
   },
   "devDependencies": {
PATCH
```

**Test:** create `deploy/pi/kiosk/test_labwc_rc.py`:
```python
"""Tests for labwc_rc.py (PLAN-M10). Run: python3 -m unittest discover -s deploy/pi/kiosk"""

import subprocess
import sys
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

import labwc_rc

SCRIPT = Path(__file__).with_name("labwc_rc.py")
NS = "{http://openbox.org/3.4/rc}"
USER_RC = """<?xml version="1.0" encoding="UTF-8"?>
<openbox_config xmlns="http://openbox.org/3.4/rc">
  <!-- written by the desktop settings -->
  <theme><name>PiXnoir</name></theme>
  <keyboard><keybind key="W-t"><action name="Execute" command="lxterminal" /></keybind></keyboard>
</openbox_config>
"""


def rules(text: str) -> list[ET.Element]:
    root = ET.fromstring(text)
    ns = NS if root.tag.startswith("{") else ""
    return [r for r in root.iter(f"{ns}windowRule") if r.get("identifier") == "chromium*"]


class AddRuleTest(unittest.TestCase):
    def test_adds_warp_and_hide_to_an_empty_config(self) -> None:
        updated = labwc_rc.add_rule(labwc_rc.EMPTY_RC)
        assert updated is not None
        (rule,) = rules(updated)
        actions = [(a.get("name"), a.get("x"), a.get("y")) for a in rule.iter(f"{NS}action")]
        self.assertEqual(actions, [("WarpCursor", "-1", "-1"), ("HideCursor", None, None)])

    def test_keeps_existing_settings_and_comments(self) -> None:
        updated = labwc_rc.add_rule(USER_RC)
        assert updated is not None
        self.assertIn("<name>PiXnoir</name>", updated)
        self.assertIn('command="lxterminal"', updated)
        self.assertIn("<!-- written by the desktop settings -->", updated)
        self.assertNotIn("ns0:", updated)
        self.assertEqual(len(rules(updated)), 1)

    def test_is_idempotent(self) -> None:
        once = labwc_rc.add_rule(USER_RC)
        assert once is not None
        self.assertIsNone(labwc_rc.add_rule(once))

    def test_reuses_an_existing_window_rules_block(self) -> None:
        text = USER_RC.replace(
            "</openbox_config>",
            '<windowRules><windowRule identifier="pcmanfm" serverDecoration="no" /></windowRules>\n</openbox_config>',
        )
        updated = labwc_rc.add_rule(text)
        assert updated is not None
        root = ET.fromstring(updated)
        self.assertEqual(len(root.findall(f"{NS}windowRules")), 1)
        self.assertEqual(len(root.findall(f"{NS}windowRules/{NS}windowRule")), 2)

    def test_accepts_a_config_without_namespace(self) -> None:
        updated = labwc_rc.add_rule("<openbox_config><theme /></openbox_config>")
        assert updated is not None
        self.assertEqual(len(rules(updated)), 1)

    def test_rejects_other_xml(self) -> None:
        with self.assertRaises(ValueError):
            labwc_rc.add_rule("<menu />")


class CliTest(unittest.TestCase):
    def run_cli(self, path: Path) -> str:
        done = subprocess.run([sys.executable, str(SCRIPT), str(path)], capture_output=True, text=True, check=True)
        return done.stdout.strip()

    def test_creates_a_missing_file_then_leaves_it_alone(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "labwc" / "rc.xml"
            self.assertEqual(self.run_cli(path), "added")
            first = path.read_bytes()
            self.assertEqual(self.run_cli(path), "unchanged")
            self.assertEqual(path.read_bytes(), first)


if __name__ == "__main__":
    unittest.main()
```

**Verify:**
- `python3 -m unittest discover -s deploy/pi/kiosk -v` → 7 tests, `OK`.
- `pnpm pi:test` → the 15 lib checks, `all lib.sh tests passed`, then `Ran 7 tests … OK`.
- `pnpm verify` green.

**Commit:** `git commit -m "feat(deploy): labwc window rule that hides the pointer on the kiosk"`

---

### T13 — Step 40 (`--kiosk`): autologin, no OS blanking, autostart, pointer rule
- [ ] done

**Files:** `deploy/pi/steps/40-kiosk.sh`

**Context:** M10 scope bullet 4 (launch script in the labwc autostart, `install.sh --kiosk` installs it for the desktop
user, OS blanking disabled; Chromium is `chromium` or `chromium-browser` — detect); ARCHITECTURE §9; Decisions D5–D7.
The kiosk user is `$SUDO_USER` (the desktop user who ran `sudo …/install.sh --kiosk`; on R-101 `eduscope`). Autologin uses
`raspi-config nonint do_boot_behaviour B4` (desktop autologin as `SUDO_USER`; it sets `autologin-user=` in
`/etc/lightdm/lightdm.conf` and `graphical.target`), so the step checks exactly those two things first. The app's own dim
(5 min) and blank (15 min) overlays (H23, `features/kiosk/SleepOverlay.tsx`) are untouched.

**Do:**
1. Create `deploy/pi/steps/40-kiosk.sh`:
```bash
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

  rc_result=$(runuser -u "$kiosk_user" -- python3 "$HERE/kiosk/labwc_rc.py" "$labwc_dir/rc.xml")
  if [[ $rc_result != unchanged ]]; then changed "labwc rc.xml: cursor rule $rc_result"; fi

  if ((EDUSCOPE_CHANGES > kiosk_changes_before)); then
    log "kiosk configured for $kiosk_user: reboot to start it (sudo reboot)"
  fi
fi
```

**Verify:**
1. `pnpm pi:lint` exits 0.
2. **[ON PI · HUMAN]** `! sudo deploy/pi/install.sh --kiosk` → shows `added to /home/eduscope/.config/labwc/autostart: /home/eduscope/edcontrol/deploy/pi/kiosk/launch.sh &`,
   `labwc rc.xml: cursor rule added`, `kiosk configured for eduscope: reboot to start it`, then `restarted eduscope.target`
   (any change restarts the services; harmless). On R-101 autologin is already on, so there is no `desktop autologin` line.
3. **[ON PI · HUMAN]** `! sudo deploy/pi/install.sh --kiosk` again → `No changes.`
4. **[ON PI · HUMAN]** `! sudo reboot`. After boot, the human checks on the Pi's screen and reports:
   S1 full screen, no browser UI, **no pointer** (moving the mouse shows it again — expected, D6); no padlocks and no Lock
   button; Settings asks for the technician PIN. Then, as the executor: `tail -5 ~/.cache/eduscope-kiosk.log` shows
   `waiting for http://localhost/api/health` and `starting /usr/bin/chromium http://localhost`.
5. If the pointer stays visible after boot (and the mouse was not moved): write a Blocker "T13: Chromium's Wayland
   app_id does not match `chromium*`" with the contents of `~/.config/labwc/rc.xml`, and stop (D6 is `[ASSUMED]`; do not
   try other identifiers).
6. `pnpm verify` green.

**Commit:** `git commit -m "feat(deploy): --kiosk installs autologin, autostart and no OS blanking"`

---

### T14 — `deploy/pi/README.md`
- [ ] done

**Files:** `deploy/pi/README.md`

**Context:** M10 scope bullet 6 (install, update `git pull && ./install.sh`, logs, how to change PINs) and notes (DHCP
reservation, client isolation). PIN copy matches the app: Settings → Devices → "Room PIN" / "Technician PIN" →
**Change** (`features/settings/devices/PinsCard.tsx`). `sqlite3` is not installed on the Pi, so the backup uses `tar` with
the services stopped.

**Do:**
1. Create `deploy/pi/README.md`:
````markdown
# Eduscope Central on the Raspberry Pi

One Pi per room (R-101). It serves the control UI to every browser on the room network at
`http://r-101.local` and, if a screen is attached, shows it full screen as the room kiosk.
Platform: Raspberry Pi 5, Raspberry Pi OS based on Debian 13 "trixie", Node 24 (decision D-22).

## 1 Install

You need a Pi with network access and a user account that can `sudo` (here: `eduscope`).

```sh
git clone <repo-url> ~/edcontrol
cd ~/edcontrol
sudo deploy/pi/install.sh            # headless Pi: services only
sudo deploy/pi/install.sh --kiosk    # with a screen: also the kiosk for the user running sudo
```

The installer:
- installs build tools, avahi, **Node 24 from NodeSource** (it removes Debian's own `nodejs` 20
  package first), pnpm (the version in `package.json`) and uv 0.13.1;
- uses the `eduscope` account for the services (it creates a system user if there is none) and adds
  it to the `dialout`, `gpio` and `audio` groups;
- creates `/var/lib/eduscope` (database) and `/etc/eduscope/{core,hw}.env` (mode 600, **only if
  missing**, with a random cookie secret and the fixed demo PINs room `1234` / technician `123456`, D-24);
- builds the code as the owner of the checkout (`pnpm install --frozen-lockfile`, `pnpm build`,
  `uv sync --frozen`);
- installs and enables `eduscope.target`, `eduscope-hw.service`, `eduscope-core.service` and
  `eduscope-restart.path`, makes the journal persistent (max 200 MB) and sets the hostname to `r-101`;
- with `--kiosk`: desktop autologin, OS screen blanking off, the Chromium launcher in the labwc
  autostart and a labwc rule that hides the mouse pointer. Reboot afterwards.

The checkout must stay where it is: the services run the code from it. The `eduscope` user must be
able to read it (true when the checkout is in `/home/eduscope`).

The first-boot PINs are the fixed demo PINs: room `1234`, technician `123456` (D-24). **Change them in
the app after the demo** (section 4).

## 2 Update

```sh
cd ~/edcontrol
git pull
sudo deploy/pi/install.sh            # add --kiosk if this Pi runs the kiosk
```

It rebuilds and restarts the services only when something changed; otherwise it prints
`No changes.`

## 3 Check and logs

```sh
systemctl status eduscope-core eduscope-hw          # both "active (running)"
curl -s http://127.0.0.1/api/health                 # {"ok":true,"hw":"up",...}
journalctl -u eduscope-core -u eduscope-hw -f       # live logs (kept across reboots)
journalctl -u eduscope-core -b -1                   # core-api logs of the previous boot
cat ~/.cache/eduscope-kiosk.log                     # kiosk browser (desktop user)
```

Restart everything: Settings → About → **Restart controller**, or
`sudo systemctl restart eduscope.target`.

## 4 PINs

- Change the room PIN and the technician PIN in the app: Settings (technician PIN) → Devices →
  Room PIN / Technician PIN → **Change**. That is the only way once the system has started.
- `INITIAL_ROOM_PIN` / `INITIAL_TECH_PIN` in `/etc/eduscope/core.env` are used **only on the first
  start with an empty database**. Editing them later changes nothing.
- Forgotten technician PIN: stop the services, move the database away, set new initial PINs, start.
  This resets every setting (schedule, IR codes, devices):
  ```sh
  sudo systemctl stop eduscope.target
  sudo mv /var/lib/eduscope/eduscope.db /var/lib/eduscope/eduscope.db.old
  sudo rm -f /var/lib/eduscope/eduscope.db-wal /var/lib/eduscope/eduscope.db-shm
  sudoedit /etc/eduscope/core.env                    # INITIAL_ROOM_PIN=4 digits, INITIAL_TECH_PIN=6 digits
  sudo systemctl start eduscope.target
  ```

## 5 Hardware drivers

`/etc/eduscope/hw.env` starts with `HW_MODE=fake`: every device is simulated. Each hardware
milestone switches its own module, e.g. `HW_DRIVERS=ir=real`, then
`sudo systemctl restart eduscope.target`. The installer never overwrites this file.

## 6 Backup

Back up the database (settings, schedule, IR codes) and the env files. Stop the services for the
copy so the SQLite files are consistent:

```sh
sudo systemctl stop eduscope.target
sudo tar -czf ~/eduscope-backup-$(date +%F).tar.gz /var/lib/eduscope /etc/eduscope
sudo systemctl start eduscope.target
```

The archive holds the cookie secret: keep it off shared drives.

## 7 Developing on this Pi

`pnpm dev` needs the ports the services use (hw-service 8081). Stop the services first and start
them again afterwards:

```sh
sudo systemctl stop eduscope.target
pnpm dev
sudo systemctl start eduscope.target
```

## 8 Network (ask IT)

- **DHCP reservation** for the Pi, so its IP never changes (phones that cannot resolve `.local` use
  the IP; Settings → Network shows it).
- **No client isolation** on the room Wi-Fi: phones and laptops must be able to reach the Pi.
- mDNS (UDP 5353) allowed on the room network, so `r-101.local` resolves.

## 9 What runs where

| Unit | Process | Listens on |
|---|---|---|
| `eduscope-core.service` | `node apps/core-api/dist/main.js` as `eduscope` | `0.0.0.0:80` (UI, `/api`, `/ws`) |
| `eduscope-hw.service` | `services/hw/.venv/bin/uvicorn` as `eduscope` | `127.0.0.1:8081` only |
| `eduscope-restart.path` | watches `/var/lib/eduscope/restart.request` | — |
| `eduscope.target` | starts both services at boot | — |
````

**Verify:** every command in the README exists in this plan's scripts or is a standard tool; `pnpm verify` green.

**Commit:** `git commit -m "docs: deploy/pi README (install, update, logs, PINs)"`

---

### T15 — Acceptance walk-through (M10 criteria)
- [ ] done

**Files:** this plan file only (tick the boxes; write any failure under `## Blockers` and stop).

**Context:** every M10 acceptance criterion with its exact check. Steps marked **HUMAN** need root or a person at the
Pi's screen / a phone; ask the human and write their observed result next to the item in your report. "Phone" = a phone on
the room Wi-Fi; "laptop" = any other machine on the same network. PINs = room 1234, technician 123456 (D-24).

Deviations from the milestone text, by decision: AC1 says "fresh Bookworm Pi" — the platform is Debian 13 trixie (D-22),
and R-101 is not fresh: AC1 is checked as "a re-run on R-101 changes nothing"; a fresh-card install is optional (item 1b).
AC6 uses the unit's MainPID instead of `pgrep -f core-api`, because `pgrep -f` also matches the shell that runs the
command (its command line contains "core-api") and would kill it.

**Do:**
1. **AC1 — idempotent install.**
   a. **HUMAN:** `! sudo bash -c 'touch /tmp/m10-mark; sleep 1; deploy/pi/install.sh --kiosk; echo "exit $?"; find /etc/eduscope /etc/systemd/system /etc/systemd/journald.conf.d /etc/apt/sources.list.d /etc/apt/preferences.d /var/lib/eduscope/build.stamp -maxdepth 1 -newer /tmp/m10-mark'`
      → the run ends with `No changes.` then `exit 0`, and `find` prints nothing.
   b. *(optional, only if the human has a spare SD card)* fresh Raspberry Pi OS (trixie, 64-bit) on a Pi 5:
      `git clone … ~/edcontrol && cd ~/edcontrol && sudo deploy/pi/install.sh` completes and prints the PINs; run again →
      `No changes.`
2. **AC2 — services and reboot.** `systemctl is-active eduscope-core eduscope-hw` → `active` twice. **HUMAN:**
   `! sudo reboot`. After boot, over SSH **before anyone touches the screen**: `systemctl is-active eduscope-core eduscope-hw`
   → `active` twice; `systemctl show -p ActiveEnterTimestamp eduscope-core` is a few seconds after
   `uptime -s`. (They are started by `multi-user.target`, not by the desktop login.)
3. **AC3 — LAN access.** `ip -4 -br addr` → note the Pi's address. **HUMAN (phone):** open `http://r-101.local` and
   `http://<ip>` → both show S1 with live values and no "Reconnecting…" banner; tap a control → PIN sheet → room PIN →
   the control works (e.g. lights on, then off). If the phone can't resolve `.local` (some Android builds), note it — the
   IP must work.
4. **AC4 — hw-service is local only.** **HUMAN (laptop):** `curl -m 3 http://r-101.local:8081/v1/health; echo $?` → a
   non-zero code (7 refused or 28 timeout). On the Pi: `curl -s 127.0.0.1:8081/v1/health` → JSON with `"ok":true`;
   `ss -ltnp | grep -E ':(80|8081)\b'` → `0.0.0.0:80` (node) and `127.0.0.1:8081` (uvicorn), nothing else on those ports.
5. **AC5 — not root.** `ps -o user=,args= -C node | grep 'apps/core-api/dist/main.js'` → starts with `eduscope`, and
   `ss -ltn | grep ':80 '` shows the port bound. (`ps -o user= -C node` alone also lists zigbee2mqtt and other node
   processes; all must be `eduscope` — none is `root`.)
6. **AC6 — crash recovery.** Keep S1 open on the phone. **HUMAN:**
   `! sudo kill -9 $(systemctl show -p MainPID --value eduscope-core); sleep 5; systemctl is-active eduscope-core; systemctl show -p NRestarts eduscope-core`
   → `active` and `NRestarts=` one higher than before. The phone shows "Reconnecting…" then "Back online".
7. **AC7 — kiosk.** **HUMAN (at the Pi's screen)** after the AC2 reboot: S1 full screen, no tabs/address bar, no pointer;
   no padlocks, no Lock button; Settings asks for the technician PIN (123456). Leave the screen untouched: after 5 min
   it dims, after 15 min it goes black (the app's overlays, H23); the first tap only wakes it (R15). At ~20 min, on the Pi:
   `pgrep -a swayidle` → nothing, and
   `WAYLAND_DISPLAY=wayland-0 XDG_RUNTIME_DIR=/run/user/$(id -u) wlr-randr | grep -E '^[A-Z]|Enabled'` → the HDMI output
   still `Enabled: yes` (the OS never turned the display off).
8. **AC8 — Restart controller.** Note `systemctl show -p ActiveEnterTimestamp eduscope-core eduscope-hw`. **HUMAN:**
   phone or kiosk → Settings → technician PIN → About → **Restart controller** → confirm. Within ~10 s both timestamps
   are newer; `journalctl -u eduscope-restart.service -n 5 --no-pager` shows it ran; every client shows "Back online"
   and live values again.
9. **AC9 — logs.** `journalctl -u eduscope-core -u eduscope-hw -n 20 --no-pager` shows lines from both units;
   `journalctl -u eduscope-core -b -1 -n 5 --no-pager` shows core-api lines from before the AC2 reboot.
10. `pnpm verify` green; `git status --short` clean apart from this plan file.

**Verify:** all ten items pass as written. Any failure → `## Blockers` (item, observed output) and stop.

**Commit:** `git commit -m "docs: M10 acceptance walk-through"`

## Checkpoints

- After T8: "Human: `ping r-101.local` from a laptop answers; `ssh eduscope@r-101.local` works (the old `eduscope.local`
  name is gone, D10)."
- After T10: "Human: open `http://r-101.local` on a phone — S1 live (phone-width 390px layout), room PIN unlocks control."
- After T13: "Human: reboot with the screen attached — S1 full screen at 1280×800, no browser chrome, no pointer."

## Nice-to-haves (not tasks)

- Bind core-api to `::` as well, so IPv6-first clients don't need the IPv4 fallback.
- An `uninstall.sh` (disable units, remove `/etc/eduscope`, keep the database).
- Move zigbee2mqtt's unit from the nvm Node to `/usr/bin/node` (H01 owns this).
- A health line in `install.sh`'s summary showing the Pi's IP for phones that can't resolve `.local`.

## Blockers

### Blocker 1 — requested fixed PINs contradict Decision D4 (found before T3)
- **Task:** T3 (`ensure_env_file`, `test-lib.sh`), T4 (`core.env.example`), T8/T15 (PIN output); also README T14.
- **Problem:** the user asked mid-run: "make pins 1234 and technician pin 123456". Plan D4 says the first PINs are
  random, generated at creation, and "no PIN is hardcoded anywhere" (CLAUDE.md also forbids hardcoded PINs in hw
  code; this is deploy code). Implementing it changes a plan decision, which needs a decision record, and changes
  verbatim blocks and tests in T3/T4. Room PIN 1234 and technician PIN 123456 are trivially guessable on a LAN.
- **Options:**
  1. Keep D4 (random PINs); the human changes them to 1234 / 123456 in Settings → Devices after install.
  2. Write a decision record D-24 "fixed first-boot PINs 1234 / 123456", then change `core.env.example`
     (`INITIAL_ROOM_PIN=1234`, `INITIAL_TECH_PIN=123456`), drop `@ROOM_PIN@`/`@TECH_PIN@` and the random-digit logic
     and its tests in `lib.sh`/`test-lib.sh`, and adjust the T4 placeholder test and T8/T15/README text.
  3. Make them an install-time override (e.g. `EDUSCOPE_ROOM_PIN` / `EDUSCOPE_TECH_PIN` env vars to install.sh),
     random by default.
- **Status:** T1 done and committed. Stopped before T2; waiting for a decision.
- **Resolved:** the user chose option 2. D-24 written; T3/T4/T7/T8/T14/T15 text in this plan amended to match
  (fixed PINs 1234 / 123456, no random PINs, lib.sh test count 19 → 15).

### Blocker 2 — T7: `npm install -g pnpm` fails with EEXIST on a dangling `/usr/bin/pnpm`
- **Task:** T7, `deploy/pi/steps/10-packages.sh` (pnpm block), Verify step 2 (first human run).
- **Observed:** Node 24 from NodeSource installed fine (`v24.22.0`). Then
  `npm error EEXIST: file already exists, path /usr/bin/pnpm`. Both runs fail the same way.
- **Cause (checked):** `/usr/bin/pnpm -> ../share/nodejs/corepack/dist/pnpm.js` and `/usr/bin/pnpx -> …/pnpx.js` are
  **dangling symlinks** left behind after purging Debian's `node-corepack` (`dpkg -S` owns neither; target is gone).
  The plan did not foresee them. `npm -g` refuses to overwrite them, and `pnpm --version` fails, so install.sh
  retries npm on every run.
- **Options:**
  1. In `10-packages.sh`, before `npm install -g pnpm`, delete dangling `/usr/bin/pnpm` and `/usr/bin/pnpx`
     (`[[ -L $f && ! -e $f ]] && rm -f "$f"`), counted as a change. Safe: only broken links are touched.
  2. Pass `npm install -g --force` (overwrites any file at that path, also a real one; less careful).
  3. Human removes the two links by hand once (`! sudo rm /usr/bin/pnpm /usr/bin/pnpx`), no plan change; a fresh
     card would not have them, but the same purge on another Pi would leave them again.
- **Recommended:** option 1.
- **Status:** stopped. T7 files are created in the working tree but not committed or ticked. Waiting for a decision.
- **Resolved:** the user chose option 1; the T7 `10-packages.sh` block and the file were amended.

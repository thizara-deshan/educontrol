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

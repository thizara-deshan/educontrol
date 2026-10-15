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

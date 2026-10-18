# D-30 — Audio levels are the podium MCU's digipots; the MCU's `ok` counts as read-back

Date: 2026-10-18 · Plan: [PLAN-H06](../plans/PLAN-H06-podium-mcu.md) (D3, D4, D6) · Status: **accepted by the owner
2026-10-18** · Supersedes: SPEC §1 hardware table, Audio row ("system mixer, 0–100, read back"); ARCHITECTURE §7.2
`audio` row ("ALSA mixer on the Pi via `amixer`") and §7.3 "Audio mixer is local to the Pi". Answers Q8 (first half).

## Context

R-101's two audio channels are set by the hardware engineer's podium MCU: an ESP32 on USB serial that drives four
X9C103S digital potentiometers, ganged into two stereo pairs: CS A = PC audio, CS B = lecturer microphone (firmware
`eduscope-podium-mcu 2.1`, `reference/hardware-drops/2026-10-18-podium-mcu/podium_mcu.ino`, pin map). There is no ALSA
mixer and nothing on the Pi to read a level from.

- **No physical read-back.** The X9C cannot report its wiper position. The firmware counts taps from a homing sweep and
  reports `-1` until it has homed since boot (`fw:setTap`, `fw:x9cHome`). `vol?` turns its own tap count back into a
  level, which is rounded on a power curve (taper 2.5), so it rarely returns the exact level sent (50 → tap 18).
- **No mute command** exists in the firmware.
- **`volsave`** writes the wiper to the X9C's EEPROM, which is rated for 100k writes.
- core-api confirms `audio.level` only when the reported level equals the requested one (`commands/policies.ts`).

## Decision

1. **Backend.** The `audio` real driver drives the digipots through the podium MCU transport. `pc` → channel `a`,
   `mic` → channel `b` (`HW_PODIUM_PC_CH`, `HW_PODIUM_MIC_CH`; `[ASSUMED]` until PLAN-H06 AC3).
2. **What "confirmed" means for audio.** `level` sends `vol <ch> <level>`. When the MCU answers `ok`, the driver
   emits `audio.state` with the **requested** level, not `vol?`'s rounded value. A level is "confirmed" when the MCU
   has accepted and carried out the wiper move. There is no physical read-back; S1 shows the same "confirmed" style as
   before.
3. **Mute is done in hw-service.**
   - `mute(ch, true)` remembers the channel's level, sends `vol <ch> 0` and reports
     `{level: <remembered>, muted: true}`.
   - `mute(ch, false)` sends `vol <ch> <remembered>` and reports `muted: false`.
   - A level set while muted only updates the remembered level; no wiper moves.
   - Mute all (R9) works unchanged on top of this.
4. **Start levels.** When the MCU reports `-1` (after its boot, which every port open causes), the driver sets
   `HW_AUDIO_START_MIC` / `HW_AUDIO_START_PC` (default 60 / 40). S1 never shows empty audio cards.
5. **`volsave` is never sent** by hw-service. `tap`, `taper`, `thresh` and `pol` are technician console commands only.

## Consequences

- If the MCU resets without hw-service noticing, the reported levels can be wrong. Its boot always sends `evt ready`,
  which the driver handles by applying the start levels again, so this window is short.
- After any hw-service restart or USB reconnect, both levels go back to the start levels; anything set during class
  is lost. This is accepted.
- `[ASSUMED]` tap 0 is silent (PLAN-H06 AC4). Levels 1–12 round to tap 0 at taper 2.5, so the bottom of each slider
  is silent. Tuning the taper is the engineer's job (Q-P2).
- No contract change. Q8b (what a drag while muted does) is unchanged: it unmutes all.

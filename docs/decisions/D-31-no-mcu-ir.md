# D-31 — There is no ESP32 IR fallback (`ir_mcu` has no hardware)

Date: 2026-10-18 · Plan: [PLAN-H06](../plans/PLAN-H06-podium-mcu.md) (D7) · Status: **accepted by the owner 2026-10-18**
· Supersedes: SPEC R8 ("IR fallback … ESP32 emitters on GPIO 16 and 17") and the S3.E11 "FALLBACK" card text;
ARCHITECTURE §7.2 `ir` row, the `ir_mcu = ESP32 on GPIO 16/17 via serial` part.

## Context

SPEC R8 and S3.E11 promise that a device's IR transport can be switched to `mcu`, using ESP32 emitter heads on GPIO 16
and 17. The podium MCU firmware that is now in the room (`eduscope-podium-mcu 2.1`,
`reference/hardware-drops/2026-10-18-podium-mcu/podium_mcu.ino`) says "IR is NOT here. It lives on the Zigbee
blaster." It uses GPIO 16/17 for RS232 (`Serial2` → MAX3232) and has no IR send or learn command. The older ESP32 drop
that had IR (INTAKE-01 Part A) is not in the room.

Already true in the code: the real `ir` driver refuses `ir_mcu` with `invalid` ("not available yet"). core-api treats
`ir_mcu` devices as reachable while hw-service is up (`domain/devices.ts`). S3 still offers "MCU" as a transport and
shows the Fallback card.

## Decision

1. R-101 has **no IR fallback**. All IR goes through the ZS06. The firmware's GPIO 16/17 are RS232.
2. **No code changes under PLAN-H06.** The hw `ir` driver keeps refusing `ir_mcu`, so a device switched to "MCU" fails
   its commands with an error instead of silently doing nothing.
3. A **follow-up plan** removes or relabels the "MCU" transport option (S3d add/edit sheets, S3 remote forms) and the
   S3.E11 Fallback card, and settles M09-L1. Until then the card's text is known to be wrong.

## Consequences

- If the ZS06 fails, IR devices (projector, AC) cannot be controlled from Central until it is replaced or re-paired.
- If the engineer later adds IR to some board (PLAN-H06 Q-P4), it needs a new record and its own code format (INTAKE-01
  CR-B).

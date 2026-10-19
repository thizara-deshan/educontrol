# D-34 — A general-purpose smart plug on the control page

Date: 2026-10-19 · Status: **requested by the owner 2026-10-19** ("no plan; add its readings and on/off below
Display") · Amends: SPEC §1 device list (S60ZBTPG), SPEC S1 layout (§2.2, ARCHITECTURE §4.1), ARCHITECTURE §7.2
module list.

## Context

R-101 has a SONOFF S60ZBTPG Zigbee smart plug with a power meter, shared with the Eduscope Unistream board (one
coordinator at a time, moved by re-pairing). SPEC models an S60ZBTPG only as the **projector's mains socket**
(`projector_power`, `r101_proj_plug`): its draw drives the projector state (R1) and the shutdown interlock (R11).
The owner's plug is **not** for the projector: anything can be plugged into it. The owner wants its readings and an
on/off control on S1, below Display.

## Decision

1. A new hw module **`plug`** (`services/hw/app/modules/plug/`), separate from `projector_power`, so the plug's
   load never drives the projector state or the interlock. `projector_power` is unchanged (still fake on R-101).
   - Real driver: zigbee2mqtt node `HW_PLUG_NODE` (default `r101_plug`): `state` ON/OFF, `power` W, `voltage` V,
     `current` A, `energy_today` kWh, `<node>/availability`. Set: `<node>/set {"state": "ON"|"OFF"}`. Key names
     from zigbee-herdsman-converters `sonoff.js` (2.14.2) `[ASSUMED]` until a report is captured on the Pi.
   - hw contract: event `plug.state` (`HwPlugStateData`: online, on, watts, volts, amps, kwh_today; null = not
     reported), request `POST /v1/plug/set` (`HwPlugSetRequest {on}`), `HwSnapshot.plug`, health `modules.plug`.
2. `RoomState.plug`: `on` (observed, source `switch`, confirmed by the plug's report), `reading` (observed
   `PlugReading`, source `power_meter`), `online`. Command `plug.set {on}`: access **control** (like the lights),
   refused while the plug is offline, confirmed when the report shows the new state. A change nobody commanded
   (the plug's own button) is attributed "by hand", as for the lights (R6).
3. S1: a **"Smart plug"** section directly below Display (left column at `lg`; after Display on phone and at
   600–1023). One card: on/off toggle row, then W · V · A · kWh today. It must keep S1 within 1280×800 (D-20).
4. The plug joins as `r101_plug` (renamed in zigbee2mqtt after pairing). It is not added to the device registry;
   S3d "Pair devices" lists it as an unregistered node.

## Consequences

- The registry's "Projector socket" (`r101_proj_plug`) and S2's projector socket card stay simulated, as before.
- `HW_DRIVERS` on R-101 gets `plug=real` (paired as `r101_plug` on 2026-10-19; first report captured in
  `services/hw/tests/test_plug.py`).
- Numbered D-34: D-30 to D-33 were taken by H06 and the S1 header work at the same time.

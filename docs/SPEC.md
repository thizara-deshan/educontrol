# Eduscope Central — Product Spec

Room: **R-101** · Source: `reference/screens/01–03` (no prototype source exists, so every
visual value is `[ESTIMATED]`) · Status: v1, 2026-10-11

Conventions:
- `[INFERRED]` = not shown on any screen; the minimum needed to make the shown screens work.
- `[ESTIMATED]` = measured by eye from screenshots.
- Text in `"quotes"` is verbatim UI copy. Copy without quotes is descriptive.
- IDs: screens `S1…`, elements `S1.E1…`, hidden states `H1…`, rules `R1…`, open questions `Q1…`.

---

## 1 Overview

Eduscope Central is the control surface for one classroom. A Raspberry Pi 4/5 in the room
talks to the room hardware and serves the UI to every browser on the room network:

- the optional Pi touchscreen (1280×800 landscape kiosk),
- the podium PC's browser,
- lecturer phones,
- technician laptops.

It controls and reports:

| Area | Hardware (as shown/stated) | Feedback |
|---|---|---|
| Display source | HDMI switch: Podium PC / Smart board | Confirmed (read-back mechanism: Q1) |
| Projector | Epson, powered over IR via ZS06 blaster; mains via Zigbee socket S60ZBTPG with power meter | Confirmed by power draw |
| Projection screen | Raise/lower (driver: Q2) | Shown confirmed |
| Audio | Lecturer microphone, PC audio (system mixer, 0–100, read back) | Confirmed |
| Lights | Zigbee 2-gang switch ZBM5-2C-86W: Front of room, Rear of room | Confirmed by the switch |
| Air conditioning | Panasonic, IR via ZS06 | Assumed only (no feedback) |
| Sensors | SNZB-02P temp/humidity, SNZB-03P occupancy, SNZB-04PR2 door | Reported readings |
| Zigbee network | Coordinator ZG-808Z | Mesh health |

Core principle: **the UI always shows what the server believes the hardware state is, and how
sure it is** (confirmed / assumed / unknown). A tap only sends a request. The visible state changes
when the server pushes the new state, never because the local tap happened.

---

## 2 Clients, access & layout

### 2.1 Client types

| Client | Viewport | Notes |
|---|---|---|
| **Kiosk**: Pi's own touchscreen (optional, Q13) | 1280×800 landscape, touch only | Identified because it is a browser running on the Pi itself. No room PIN (§2.3). |
| **Podium PC** | ≥1280 wide, mouse | Remote client |
| **Laptop** (technician) | ≥1024 wide | Remote client |
| **Phone** (lecturer) | 390 wide reference, portrait | Remote client, one-handed |

URL: `http://r-101.local`. A QR code for it is shown on S3e (About).

### 2.2 Layout breakpoints `[INFERRED]`

| Width | Layout |
|---|---|
| ≥1024 | Desktop/kiosk layouts as screenshotted. At 1280×800, S1 must fit with **no scrolling**. |
| 600–1023 | S1: two columns (Display + Audio stacked left, Environment right). S2/S3: side column drops below the main column. |
| <600 | Single column, phone layouts below. No horizontal page scroll at any width. 16px side gutter. |

**Phone layout (390px) per screen:**

**S1 Control**
- Header collapses to one 56px row:
  - wordmark "eduscope CENTRAL" (smaller),
  - status dot (tap shows the status text in a sheet),
  - room chip `R-101`,
  - icon-only **Devices** and **Settings** buttons (48×48),
  - lock button (remote, unlocked only).
  - Clock and date are hidden (the phone has its own).
- Columns stack in order: **Display → Audio → Environment** (Lights, Air conditioning, Room sensors).
- A sticky bottom bar with three 48px segments, "Display · Audio · Environment", jumps to each section. This keeps every section reachable with one thumb.
- Inside cards:
  - Source tiles stay side by side (2 × ~171px).
  - Power on/off pairs stay side by side.
  - Sliders go full width.
  - AC setpoint row stays on one line: − / value / +.
  - Sensor tiles become a 2×2 grid.
  - Captions (S1.E16) wrap.

**S2 Zigbee devices**
- Header: back "Controls" (icon + label), title, coordinator status dot. "Settings" becomes an icon.
- Order: Mains-powered routers → Battery end devices → Coordinator → Mesh → "TWO ROUTERS, NO SINGLE PATH" → Shutdown interlock.
- The battery table becomes one card per device:
  - line 1: name + reading,
  - line 2: model · friendly name,
  - line 3: battery · link · last seen.
- The four power metrics become a 2×2 grid.

**S3 Settings**
- The tab strip scrolls horizontally inside itself. The active tab is scrolled into view.
- Remote configuration becomes master → detail:
  - The device list is the first view.
  - Tapping a device opens its command table with a back arrow.
  - "+ Add device", BLASTER and FALLBACK sit below the device list.
- Command rows: line 1 is name + capture status; line 2 is **Test** and **Re-learn** at half width each (≥48px tall).
- "HOW CAPTURE WORKS" sits below the commands, collapsed to its first sentence with "More".

**S4 PIN**
- Full-screen keypad in the lower half of the screen, within thumb reach.

### 2.3 Access levels

| Level | Who | Can |
|---|---|---|
| `view` | Any LAN browser without a PIN | See S1 and S2 live. Controls render but are locked; tapping one opens S4 (room PIN). |
| `control` | Remote browser after **room PIN**; kiosk always | Operate everything on S1 |
| `technician` | Any client after **technician PIN** | Everything, plus S3 Settings (all tabs) |

Rules:
- **Room PIN:** 4 digits, one per room, set in Settings.
  - After 5 wrong attempts, entry locks for 60 s (H17).
- **Technician PIN:** 6 digits. Needed on every client, kiosk included, to open S3.
  - The S3 header shows "Technician access" while the session is active.
- **The kiosk skips the room PIN** because it is physically in the room.
- **S2 is read-only** and needs only `view`.
- **Sessions end** when any of these happens:
  - Remote `control` session: the user taps **Lock** (header, remote clients only), 2 h passes with no activity, or the current scheduled class block ends (S3c), whichever is first.
  - `technician` session: 15 min idle, or **Lock**.
  - Kiosk: after 2 min idle it returns to S1 and drops `technician`.
  - When a session ends, the client drops to `view` in place. It is not navigated away, except that S3 returns to S1.

### 2.4 Multi-client behaviour

- The server is the single source of truth. Every client renders server-pushed state.
- **Last writer wins** at the server.
- A local tap shows only a *pending* overlay on the tapped control (H5). The value/label does not change until the server pushes.
- When state changes because of another client, every other client shows a toast with **attribution**:
  - Format: "Rear of room turned on · from phone"
  - Labels `[INFERRED]`: `room screen` (kiosk), `phone`, `tablet`, `laptop`, `podium PC` (Q19).
  - Changes from outside the system are attributed too: "· by hand" for the wall plate, "· by schedule".
- Sliders: while a finger is down, the thumb follows the finger. Level updates are sent at a limited rate while dragging and the final value on release. After release, the thumb settles to the server-pushed value.
  - Another client's change does not move a slider while it is being dragged. It applies on release.

### 2.5 Connection states

Applies to all clients. Details in H2–H4.
- **Connected:** normal.
- **Reconnecting:**
  - An amber banner sits under the header: "Reconnecting…".
  - All controls are disabled and dimmed.
  - Last known values stay visible and greyed. They are not cleared.
- **Server unreachable:**
  - After 10 s, the banner turns red: "Can't reach R-101 controller".
  - It shows a **Retry** button (48px).
- **Resynced:**
  - The client receives a full state snapshot and replaces everything it shows.
  - The banner briefly shows "Back online" (green, 2 s), then hides.
  - This covers a phone waking from sleep: it must never show pre-sleep values as current.

### 2.6 Kiosk specifics

- No text selection, no long-press callout, no pinch zoom, no context menu, no visible cursor.
- **Screen sleep:**
  - Dims to ~20% after 5 min idle; blanks after 15 min.
  - The first tap only wakes the screen and is never treated as a control press.
  - Occupancy "Detected" also wakes it.
- No browser chrome; full screen.
- Touch-first everywhere, on all clients:
  - No hover-only affordances.
  - Every interactive target is ≥48×48px.
  - Pressed state is shown on touch-down.

---

## 3 Design tokens

All `[ESTIMATED]` from screenshots (displayed at ~1.47× of 1280 width; sizes below are converted to the 1280 canvas).

### 3.1 Colour

| Token | Hex | Used for |
|---|---|---|
| `bg` | `#0E1621` | Page background |
| `header` | `#121B27` | Header bar |
| `surface` | `#151F2C` | Cards |
| `surface-2` | `#1B2635` | Rows inside cards (Lights rows, table rows) |
| `control` | `#1C2938` | Neutral buttons, chips (`R-101`, Devices, Settings) |
| `border` | `#243140` | Card borders, dividers |
| `border-strong` | `#33414F` | Neutral button borders |
| `border-dashed` | `#3A4757` | Dashed border for *assumed* cards (AC) and "+ Add …" placeholders |
| `text-1` | `#E6EBF0` | Titles, values |
| `text-2` | `#9AA6B2` | Labels, subtitles, captions |
| `text-3` | `#6C7A88` | Device IDs, model numbers, section labels, "Off" |
| `accent` (green) | `#34D399` | Confirmed dots, "On", wattage, "Detected", counts |
| `accent-fill` | `#1E3A2B` | Active confirmed button / tile fill |
| `accent-border` | `#3FCF7F` | Active confirmed button / tile border |
| `selected-fill` | `#1B3A48` | Selected item (source tile, S3 device), teal-blue |
| `toggle-on` | `#3A9A5F` | Switch track (on) |
| `toggle-off` | `#2A3644` | Switch track (off); knob `#F2F4F6` |
| `warn` (amber) | `#F2A93B` | Assumed ring, "On · assumed", reconnecting |
| `warn-fill` | `#3B2A10` | Active assumed button fill |
| `brand` (red) | `#E5483F` | "CENTRAL" in the wordmark only |
| `danger` `[INFERRED]` | `#F0524F` | Failures, offline, unreachable. Kept distinct from `brand`. |
| `danger-fill` `[INFERRED]` | `#3A1618` | Failure banners/cards |
| `callout-fill` | `#11261C` | "TWO ROUTERS…" callout bg; border `#2F7A50`; title `accent` |
| `badge-router` | fill `#1F4A33`, text `#4ADE80` | "Router" badge |

There is no light theme. The UI is dark-only.

### 3.2 Typography

| Role | Face | Size / weight | Example |
|---|---|---|---|
| UI | Neutral grotesque sans (Inter-like) | — | — |
| Numbers & IDs | Monospace (JetBrains-Mono-like) | — | `10:42`, `287 W`, `R-101`, `LQI 214`, `r101_lights` |
| Wordmark | Sans, "eduscope" bold `text-1`; "CENTRAL" bold, tracking 0.12em, `brand` | 24 | — |
| Clock | Mono semibold | 28 | `10:42` |
| Date | Mono regular, `text-2` | 13 | `Mon 5 Oct` |
| Page title | Sans bold | 22 | "Zigbee devices", "Settings" |
| Section label | Sans bold, uppercase, tracking 0.14em, `text-2` | 11 | "DISPLAY" |
| Card title | Sans semibold | 16 | "Projector" |
| Card subtitle / state line | Sans regular | 12 | "On · confirmed by draw" |
| Button label | Sans semibold | 15 | "Power on" |
| Big value | Mono semibold | 22–24 | `62`, `287 W`, `26.4°`, `24°` |
| Sensor label | Sans bold uppercase, tracking 0.1em | 10 | "TEMPERATURE" |
| Device ID / caption | Mono (IDs) or sans (captions), `text-3`/`text-2` | 11–12 | `SNZB-02P` |

### 3.3 Shape, spacing, targets

| Token | Value |
|---|---|
| Radius: card | 10 |
| Radius: button / tile | 8 |
| Radius: chip / badge | 6 |
| Radius: toggle | full |
| Spacing scale | 4 · 8 · 12 · 16 · 24 · 32 |
| Page gutter | 24 (kiosk/desktop), 16 (phone) |
| Column gap | 16 |
| Card padding | 16 |
| Header height | 64 (desktop), 56 (phone) |
| Min touch target | **48×48** everywhere |
| Primary action buttons (Power on/off, Raise) | 56 tall. The screenshots show ~43, which is raised to 56. |
| Toggle hit area | Whole row (≥56 tall), not just the switch |
| Slider | Track 8 tall; thumb 30 visual / 48 hit area |
| PIN keypad keys | 64×64 |
| Border width | 1 (normal), 2 (selected/active), 1 dashed (assumed) |

### 3.4 State language (the system's core visual grammar)

| State | Dot | Text | Active control | Card border |
|---|---|---|---|---|
| Confirmed on/active | Solid `accent` | `accent` or `text-2` | `accent-fill` + `accent-border` | solid `border` |
| Selected (choice) | — | "Selected, confirmed" in `accent` | `selected-fill` + `accent-border` | — |
| Assumed | Hollow `warn` ring | `warn` ("On · assumed") | `warn-fill` + `warn` border | **dashed** `border-dashed` |
| Off / idle | Solid `text-3` grey | `text-3` | neutral | solid |
| Unknown `[INFERRED]` | Hollow `text-3` ring | "Unknown" `text-3` | none highlighted | dashed |
| Stale `[INFERRED]` | Dot at 40% opacity | value in `text-3` + "· 14 min ago" | — | solid |
| Offline / failed `[INFERRED]` | Solid `danger` | `danger` | controls disabled | solid `danger` at 40% |
| Pending `[INFERRED]` | — | — | tapped button: border pulses `text-2`, label unchanged | — |

---

## 4 Screens

### S1 Control (`/`)

**Purpose:** everyday room control.

**Layout:**
- Header, then three equal columns: DISPLAY | AUDIO | ENVIRONMENT.
- Display holds three cards (sources, projector, screen).
- Audio holds two slider cards and a mute bar.
- Environment holds Lights, Air conditioning, Room sensors.

**Header:**

| ID | Element | Data | States | On tap | Notes |
|---|---|---|---|---|---|
| S1.E1 | Wordmark "eduscope" + "CENTRAL" | — | — | Nothing | |
| S1.E2 | Clock `10:42` | Pi local time, 24 h | — | Nothing | Mono. Server time, not client time. |
| S1.E3 | Date `Mon 5 Oct` | Pi local date | — | Nothing | Format `ddd d Mon` |
| S1.E4 | System status "● All systems normal" | Room status summary | normal (green dot, "All systems normal"); degraded `[INFERRED]` (amber dot, e.g. "1 device offline", "Sensor not reporting"); fault `[INFERRED]` (red dot, e.g. "Coordinator offline", "Controller offline") | `[INFERRED]` Opens S2 | Phone: dot only |
| S1.E5 | Room chip `R-101` | Room id | — | Nothing | Mono, boxed |
| S1.E6 | **Devices** button (wifi icon) | — | normal / pressed | Navigate to S2 | |
| S1.E7 | **Settings** button (gear icon) | — | normal / pressed | `technician`: S3. Else: S4 (technician PIN), then S3 | |
| S1.E8 | **Lock** button `[INFERRED]` | — | Shown only for remote `control`/`technician` sessions | Ends session → `view` | Padlock icon + "Lock" |
| S1.E9 | Connection banner `[INFERRED]` | Connection state | hidden / reconnecting / unreachable / back online | Retry when unreachable | §2.5 |

**DISPLAY column:**

| ID | Element | Data | States | On tap | Notes |
|---|---|---|---|---|---|
| S1.E10 | Section label "DISPLAY" | — | — | — | |
| S1.E11 | Source tile "Podium PC" | HDMI switch selected input | Selected: "Selected, confirmed" (`selected-fill`, green border). Not selected: "Tap to select". Pending `[INFERRED]`: "Switching…". Selected but unconfirmed `[INFERRED]`: "Selected, assumed" with amber border. | Select this input | Exclusive with S1.E12. Tapping the already-selected tile does nothing. |
| S1.E12 | Source tile "Smart board" | Same | Same | Same | |
| S1.E13 | Projector header: dot, "Projector", state line, wattage `287 W` | Projector derived state (R1) + live power | "On · confirmed by draw" (green dot, wattage green). `[INFERRED]`: "Standby · confirmed by draw" (grey dot, `3 W` in `text-2`); "Warming up" / "Cooling down" (amber dot, between 5 and 50 W); "Power meter offline · state unknown" (hollow grey ring, wattage "— W") | Nothing | Wattage mono |
| S1.E14 | **Power on** | — | Active (green fill) when state is On/Warming up. Pending. Disabled during interlock `[INFERRED]`. | Send projector IR "Power on" | |
| S1.E15 | **Power off** | — | Active (neutral highlighted) when Standby/Cooling down. Pending. | Send projector IR "Power off" | |
| S1.E16 | Caption "Commanded over IR · state read back from the S60 power meter" | — | — | — | `text-2`, 12 |
| S1.E17 | Projection screen: dot, "Projection screen", state "Lowered" | Screen position | "Lowered" (green dot). `[INFERRED]`: "Raised" (grey dot), "Moving…", "Unknown" | Nothing | |
| S1.E18 | Screen action button "Raise" | — | Label is the opposite action: "Raise" when Lowered, "Lower" when Raised. Pending. | Send raise/lower | Q2 |

**AUDIO column:**

| ID | Element | Data | States | On tap | Notes |
|---|---|---|---|---|---|
| S1.E20 | Section label "AUDIO" | — | — | — | |
| S1.E21 | "Lecturer microphone" card: title, value `62`, slider | Mic level 0–100 (read back) | Normal. Muted `[INFERRED]`: value shows "Muted", track dimmed, thumb at the saved level. Dragging. Offline `[INFERRED]`. | Drag/tap the track to set the level (§2.4) | Value mono. Card tap area is the whole slider row. |
| S1.E22 | "PC audio" card: title, value `38`, slider | PC audio level 0–100 | Same | Same | |
| S1.E23 | **Mute all audio** bar with dot | All-mute flag | Unmuted: grey dot, "Mute all audio". Muted `[INFERRED]`: red/amber dot, label "Unmute all audio", `warn-fill`. Pending. | Toggle mute all (R9) | Full column width |

**ENVIRONMENT column:**

| ID | Element | Data | States | On tap | Notes |
|---|---|---|---|---|---|
| S1.E30 | Section label "ENVIRONMENT" | — | — | — | |
| S1.E31 | Lights header: dot, "Lights", "Confirmed by the switch", tag `ZBM5` | Switch online + confidence | Green dot + "Confirmed by the switch". `[INFERRED]`: switch offline → red dot, "Switch offline · last known state", rows disabled. | Nothing | Tag mono, `text-3` |
| S1.E32 | Row "Front of room" + "On"/"Off" + toggle | Gang 1 state | On (green track, "On" green). Off (grey track, "Off" `text-3`). Pending. Disabled. | Toggle gang 1 | Whole row is the target |
| S1.E33 | Row "Rear of room" + toggle | Gang 2 state | Same | Toggle gang 2 | |
| S1.E34 | AC header: ring, "Air conditioning", state line, tag "IR REMOTE" | AC assumed state | "On · assumed" (amber ring, amber text). `[INFERRED]`: "Off · assumed"; "Unknown" (nothing sent since boot). Card border always dashed. | Nothing | Never "confirmed" (R3) |
| S1.E35 | **Power on** | — | Active = `warn-fill` + amber border when assumed On. Pending. | Send AC frame for the current setpoint (power on) | |
| S1.E36 | **Power off** | — | Active (neutral highlight) when assumed Off | Send AC "Power off" frame | |
| S1.E37 | Setpoint label "Setpoint" | — | — | — | |
| S1.E38 | **−** button | — | Disabled at the lowest captured setpoint. Disabled while AC is assumed Off `[INFERRED]` (Q5). Pending. | Send the next lower captured setpoint frame (R4) | 64×64 |
| S1.E39 | Setpoint value `24°` | Last sent setpoint | Normal. Off → dimmed `[INFERRED]`. | Nothing | Mono, 24 |
| S1.E40 | **+** button | — | Mirror of S1.E38 | Send the next higher captured setpoint frame | |
| S1.E41 | Room sensors header "ROOM SENSORS" + "● 3 reporting" | Count of sensor devices reporting within threshold | All reporting (green dot, "3 reporting"). `[INFERRED]`: "2 of 3 reporting" (amber dot); "No sensors reporting" (red dot). | `[INFERRED]` Opens S2 | Counts devices, not tiles (climate = 1 device, 2 tiles) |
| S1.E42 | Tile "TEMPERATURE" `26.4°` / `SNZB-02P` | Temperature °C, 1 dp | Fresh. Stale (H10). No data "—" (H11). | Nothing | |
| S1.E43 | Tile "HUMIDITY" `61%` / `SNZB-02P` | RH %, integer | Same | Nothing | |
| S1.E44 | Tile "OCCUPANCY" `Detected` / `SNZB-03P` | Occupancy | "Detected" (green). `[INFERRED]`: "Clear" (`text-1`). Stale. No data. | Nothing | |
| S1.E45 | Tile "DOOR" `Closed` / `SNZB-04PR2` | Contact | "Closed" (`text-1`). `[INFERRED]`: "Open" (amber). Stale. No data. | Nothing | |

**View-only presentation `[INFERRED]`** (remote, no PIN):
- All S1 controls render with real state at full colour but carry a small padlock on each card header.
- Tapping any control opens S4 (room PIN). After a successful unlock, the action is **not** replayed. The user taps again.

### S2 Zigbee devices (`/devices`)

**Purpose:** read-only mesh and device health.

**Layout:**
- Header, then a main column (~75%) and a side column (~25%).
- Main column: "MAINS POWERED — ROUTERS" cards, then "BATTERY — END DEVICES" table.
- Side column: Coordinator, Mesh, callout, Shutdown interlock.

**Header:**

| ID | Element | Data | States | On tap | Notes |
|---|---|---|---|---|---|
| S2.E1 | **← Controls** | — | — | Navigate to S1 | |
| S2.E2 | Title "Zigbee devices" | — | — | — | |
| S2.E3 | "● Coordinator online" | Coordinator status | Online (green). `[INFERRED]`: "Coordinator offline" (red); "Coordinator starting…" (amber) | Nothing | |
| S2.E4 | **Settings** | — | — | As S1.E7 | |

**Main column:**

| ID | Element | Data | States | On tap | Notes |
|---|---|---|---|---|---|
| S2.E5 | Section label "MAINS POWERED — ROUTERS" | — | — | — | |
| S2.E6 | Lighting switch card header: dot, "Lighting switch", `ZBM5-2C-86W · r101_lights`, badge "Router", `LQI 214` | Node model, friendly name, role, LQI, online | Online (green dot). `[INFERRED]`: offline (red dot, "Offline · last seen 5 min ago" replacing LQI) | Nothing | IDs mono |
| S2.E7 | Tile "Front of room" "On" | Gang 1 | On: green fill/border, green dot, "On". Off: neutral, grey dot, "Off" `text-3`. | Nothing (read-only, Q11) | |
| S2.E8 | Tile "Rear of room" "Off" | Gang 2 | Same | Nothing | |
| S2.E9 | Caption "Wired with neutral, so it carries the mesh for every battery sensor in the room. The wall plate still works by hand if the network stops." | — | — | — | |
| S2.E10 | Projector socket header: dot, "Projector socket", `S60ZBTPG · r101_proj_plug`, "Router", `LQI 231` | As S2.E6 | As S2.E6 | Nothing | |
| S2.E11 | Tile "Mains to projector" "On" | Relay state | On / Off as S2.E7 | Nothing | |
| S2.E12 | Metrics: "POWER" `287 W` · "VOLTAGE" `231 V` · "TODAY" `1.84 kWh` · "RATING" `13 A` | Live W (green), V, kWh since local midnight, rated A (static) | Fresh. Stale (H10). Unavailable "—". | Nothing | POWER in `accent` |
| S2.E13 | Caption "The power reading is what turns the projector from a guess into a fact. Above about 50 W it is running; below 5 W it is in standby." | — | — | — | Rule R1 |
| S2.E14 | Section label "BATTERY — END DEVICES" | — | — | — | |
| S2.E15 | Table header "DEVICE" · "READING" · "BATTERY" · "LINK" · "LAST SEEN" | — | — | — | |
| S2.E16 | Row "Room climate" / `SNZB-02P · r101_temp` · `26.4° · 61%` · `98%` · `168` · `12s ago` | Node + latest reading | Fresh. Stale (last seen in amber, reading `text-3`). Low battery `[INFERRED]` ≤20% amber, ≤10% red. Offline. | Nothing | |
| S2.E17 | Row "Motion" (partly visible) / `SNZB-03P · r101_motion` `[INFERRED]` · reading "Detected" (green) · battery · link · last seen | Same | Same | Nothing | Values cut off in screenshot |
| S2.E18 | Row "Door" `[INFERRED]` / `SNZB-04PR2 · r101_door` · "Closed" · … | Same | Same | Nothing | |
| S2.E19 | Empty table state `[INFERRED]` | — | "No battery devices paired" | — | |

**Side column:**

| ID | Element | Data | States | On tap | Notes |
|---|---|---|---|---|---|
| S2.E20 | "COORDINATOR" card: `ZG-808Z`; "Chipset" `CC2652P1`; "Firmware" `Z-Stack 3.x.0`; "Channel" `25`; "Transmit" `+20 dBm`; "Port" `zigbee-coord`; "Antenna" `SMA, external` | Coordinator info | Online / offline (values greyed) | Nothing | Values mono, right-aligned |
| S2.E21 | "MESH" card: `5` "devices paired"; "Routers" `2`; "End devices" `3`; "Joining" "Closed" | Mesh summary | Joining "Closed". `[INFERRED]`: "Open · 4:12 left" (amber) | Nothing | Count includes ZS06? (Q4) |
| S2.E22 | Callout "TWO ROUTERS, NO SINGLE PATH": "Battery sensors can reach the coordinator through either the lighting switch or the projector socket. Losing one still leaves the room reporting." | — | `[INFERRED]` If a router is offline, the callout turns amber: "ONE ROUTER LEFT": "Battery sensors are relying on a single path. Restore the {offline router} soon." | Nothing | |
| S2.E23 | "SHUTDOWN INTERLOCK" card `[INFERRED]` | Interlock rule + status | "Armed": "Projector mains stays on until draw is below 5 W." "Holding": "Waiting for projector to cool · 112 W". "Bypassed" (technician only). | Nothing | Content unknown (Q7) |

### S3 Settings › Remote configuration (`/settings/remote`)

**Purpose:** manage the IR devices and their captured codes. Requires `technician`.

**Layout:**
- Header, then a tab bar.
- Left column (~22%): DEVICE list, "+ Add device", BLASTER, FALLBACK.
- Right column: header for the selected device, command table, "+ Add a command", "HOW CAPTURE WORKS".

**Header and tabs:**

| ID | Element | Data | States | On tap | Notes |
|---|---|---|---|---|---|
| S3.E1 | **← Controls** | — | — | Navigate to S1 (technician session stays until timeout/Lock) | |
| S3.E2 | Title "Settings" | — | — | — | |
| S3.E3 | "Technician access" | Session level | Shown while `technician` | Nothing | `[INFERRED]` "Lock" button beside it |
| S3.E4 | Room chip `R-101` | — | — | — | |
| S3.E5 | Tabs "Remote configuration" · "Network" · "Schedule" · "Devices" · "About" | Active tab | Active: `surface` fill, `text-1`, attached to the content. Inactive: `text-2`. | Switch tab (S3–S3e) | |

**Left column:**

| ID | Element | Data | States | On tap | Notes |
|---|---|---|---|---|---|
| S3.E6 | Section label "DEVICE" | — | — | — | |
| S3.E7 | Device item "Air conditioning" / "Panasonic · via ZS06" / `14` | IR device, brand, transport, command count | Selected (`selected-fill`, green border). Unselected. `[INFERRED]` Count turns amber if any command is untested. | Select; right column shows its commands | Count = captured commands |
| S3.E8 | Device item "Projector" / "Epson · via ZS06" / `2` | Same | Same (shown selected) | Same | |
| S3.E9 | "+ Add device" (dashed) | — | — | `[INFERRED]` Sheet: name, brand, transport ("ZS06" / "mcu"), kind (Projector / Air conditioning / Other) → Save | |
| S3.E10 | "BLASTER" card: dot `ZS06`, `LQI 196`; "Topic" `r101_ir`; "Coverage" `360°, 12 m`; "Mains powered, so it also routes for the battery sensors." | Blaster status | Online (green). Offline `[INFERRED]` (red, "Offline · last seen …"; Test/Re-learn disabled). | Nothing | |
| S3.E11 | "FALLBACK" card: "The ESP32 emitter heads on GPIO 16 and 17 stay wired. Switch a device to them by setting its transport to mcu in the room config." | — | — | Nothing | Static text |

**Right column:**

| ID | Element | Data | States | On tap | Notes |
|---|---|---|---|---|---|
| S3.E12 | Detail header "Projector" + "Epson · two commands · via ZS06" | Selected device | — | Nothing | Count in words for small numbers `[INFERRED]` (e.g. "14 commands") |
| S3.E13 | Table header "COMMAND" · "CAPTURE" | — | — | — | |
| S3.E14 | Command row "Power on" · "Tuya code · captured" · **Test** · **Re-learn** | IR command, capture status, test status | "Tuya code · captured". `[INFERRED]`: "Not captured" (amber; Test disabled, Re-learn reads "Learn"); "Tuya code · captured · untested" (amber); "Tuya code · tested ✓ 2 min ago"; "Tuya code · no reaction" (red); "Listening…" during capture | Test: send code, then ask for confirmation (R5). Re-learn: capture flow (H21). | Status mono, `text-2` |
| S3.E15 | Command row "Power off" | Same | Same | Same | |
| S3.E16 | "+ Add a command" (dashed) | — | — | `[INFERRED]` Sheet: name (for AC: setpoint °C, mode, fan) → creates the row → starts the capture flow | |
| S3.E17 | "HOW CAPTURE WORKS" card | — | — | Nothing | Copy below |

S3.E17 copy (verbatim):
- "An air-conditioning remote does not send “temperature up”. It sends a complete state frame carrying power, mode, temperature and fan speed together. Set the handheld remote to exactly the state you want, then press any button — whatever is captured reproduces that whole state."
- "That is why each setpoint is a separate entry rather than a plus and minus pair. The projector needs only two."
- "Test every code the moment you capture it. The same button can return a different string each time, so comparing text proves nothing — only the hardware reacting does." (`text-2`, smaller)

### S3b Settings › Network `[INFERRED]` (`/settings/network`)

Single column of label/value rows, with the same frame as S3:
- "Hostname": `r-101.local`
- "Address": IP
- "Connection": "Ethernet" / "Wi-Fi · {SSID} · {signal}"
- "Controller": "Online"
- "Connected clients": count, with a list of labels (e.g. "room screen", "phone ×2")

No editing in v1.

### S3c Settings › Schedule `[INFERRED]` (`/settings/schedule`)

- A list of class blocks: day(s), start–end. These are used to end control sessions (§2.3).
- A list of timed actions, e.g. "All off · 18:00 weekdays". Each has an enable toggle and a delete button.
- "+ Add block", "+ Add action" (dashed, like S3.E9).
- Timed actions run as the attribution "schedule".

### S3d Settings › Devices `[INFERRED]` (`/settings/devices`)

- Registry of every room device: name, kind, transport (`zigbee` / `ZS06` / `mcu` / `local`), hardware ID or friendly name.
- Row tap opens an edit sheet: rename, change transport, remove.
- "Permit joining" button opens the Zigbee mesh for 4 min (S2.E21 shows the countdown).
- PIN management also lives here:
  - "Room PIN": "Change"
  - "Technician PIN": "Change"

### S3e Settings › About `[INFERRED]` (`/settings/about`)

- Room `R-101`.
- Software version, controller uptime, Pi model.
- **QR code for `http://r-101.local`** with the URL as text beneath it.
- "Restart controller" button (asks to confirm).

### S4 PIN entry `[INFERRED]` (overlay on the current screen)

| ID | Element | Data | States | On tap | Notes |
|---|---|---|---|---|---|
| S4.E1 | Title "Enter room PIN" / "Technician PIN" | Requested level | — | — | |
| S4.E2 | Room chip `R-101` | — | — | — | |
| S4.E3 | PIN dots (4 or 6) | Digits entered | Empty / filled / error (shake + red "Wrong PIN") / locked "Too many tries · wait 0:58" | — | |
| S4.E4 | Keypad 1–9, ⌫, 0 | — | Pressed. Disabled while locked. | Enter a digit; submits automatically when complete | 64×64 keys, lower half on phone |
| S4.E5 | "Cancel" | — | — | Close; stay `view` | |

### S5 Connection banner `[INFERRED]` (global, under the header)

See §2.5 and H2–H4.

---

## 5 Hidden states

| ID | State | Where | Presentation |
|---|---|---|---|
| H1 | Initial load (no snapshot yet) | All screens | Full layout with skeleton blocks in `surface-2` where values go. No controls enabled. Header shows `R-101`; status reads "Connecting…". |
| H2 | Server unreachable | All | Red banner "Can't reach R-101 controller" + **Retry**. Values greyed (last known). Controls disabled. |
| H3 | Reconnecting | All | Amber banner "Reconnecting…". Values greyed. Controls disabled. |
| H4 | Resynced | All | Full snapshot replaces everything. Green banner "Back online" for 2 s. Any local pending overlays are cleared. |
| H5 | Command in flight | Any control | Tapped control gets a pulsing `text-2` border. Its label/value does **not** change. Other controls stay usable. Same-control repeat taps are ignored while pending. |
| H6a | Command failed | Any control | Pending clears. The card shows a red inline line for 6 s: "Couldn't reach the blaster" / "Switch didn't respond" / "Command failed". State keeps the server value. |
| H6b | Command timed out | Any control | Same as H6a: "No response · tap to retry". Timeout per transport (Q12). |
| H7 | IR sent, no feedback possible | AC | State becomes "· assumed". No "confirmed" ever. |
| H7b | IR sent, waiting for feedback | Projector | State line shows "Power on sent · waiting for draw" until R1 confirms. After 90 s with no change: "Power on sent · no change in draw" (amber). |
| H8 | Device offline | Device card | Red dot, "{Device} offline · last known state", controls disabled, last values greyed. Header S1.E4 goes amber. |
| H9 | Coordinator offline | S1, S2 | S1.E4 red "Coordinator offline". All Zigbee-backed controls/readings show H8. S2.E3 red. |
| H10 | Sensor stale | Sensor tiles, S2 rows | Value in `text-3`, dot at 40%, suffix "· 14 min ago". "3 reporting" count drops. |
| H11 | No data ever | Sensor tiles, metrics | "—" with "No reading yet" in `text-3`. |
| H12 | Locked (view-only) | S1 | Padlock on card headers. Tap opens S4. |
| H13 | Changed by another client | All | Toast (bottom, 4 s): "{Thing} {change} · from {label}". The control animates to the new state. |
| H14 | Projector transitioning | S1.E13 | "Warming up" / "Cooling down", amber dot, live wattage. |
| H15 | Interlock holding | S1.E13, S2.E23 | Line "Mains held on until projector cools". Mains control (if any) disabled. |
| H16 | Low battery | S2 rows | Battery value amber ≤20%, red ≤10%. S1.E4 degraded: "Sensor battery low". |
| H17 | PIN lockout | S4 | Keypad disabled, countdown "Too many tries · wait 0:58". |
| H18 | Audio muted | S1 Audio | Mute bar active ("Unmute all audio"). Sliders dimmed; values show "Muted". Dragging a slider while muted unmutes all `[INFERRED]` (Q8b). |
| H19 | Setpoint at bound | S1.E38/40 | The button at the limit is disabled (40% opacity). |
| H20 | Untested IR code | S3 | Row status amber "untested". Device count amber. |
| H21 | Capture flow | S3 row | Row shows "Listening… point the remote at the ZS06 and press the button" with 20 s countdown and **Cancel**. Captured → "Captured · now test it" + Test highlighted. Timeout → "Nothing received" + **Try again**. The new code replaces the old only after capture succeeds. |
| H22 | Test confirmation | S3 row | After Test sends: inline prompt "Did the {device} react?" **Yes** / **No**. Records tested / no reaction. |
| H23 | Kiosk dim / blank | Kiosk | 20% brightness, then black. First tap wakes only. |
| H24 | Session expired | Remote | Toast "Locked · enter PIN to control". Controls go to H12. On S3 → navigate to S1. |
| H25 | Blaster offline | S1 projector/AC, S3 | IR controls disabled. "IR blaster offline". Test/Re-learn disabled. |

---

## 6 Domain model

All entities are server-side and pushed to clients. Timestamps are server time.

### Room
| Field | Type |
|---|---|
| `id` | `"R-101"` |
| `hostname` | `"r-101.local"` |
| `status` | `normal \| degraded \| fault` |
| `status_text` | e.g. "All systems normal" |
| `active_source` | `podium_pc \| smart_board` |

### Observed\<T\> (wraps every hardware value)
| Field | Type |
|---|---|
| `value` | T or null |
| `confidence` | `confirmed \| assumed \| unknown` |
| `source` | `switch \| power_meter \| hdmi_switch \| mixer \| ir \| sensor \| manual \| none` |
| `updated_at` | timestamp |
| `stale` | bool (computed from `updated_at` + staleness threshold) |
| `changed_by` | ClientLabel or `by hand` or `schedule` or null |

### Device
| Field | Type |
|---|---|
| `id`, `name` | "Projector", "Air conditioning", … |
| `kind` | `projector \| hdmi_switch \| projection_screen \| lights \| ac \| audio \| power_socket \| sensor \| ir_blaster \| coordinator` |
| `transport` | `zigbee \| ir_zs06 \| ir_mcu \| local` |
| `brand`, `model` | "Epson", "Panasonic", "ZBM5-2C-86W" |
| `online` | Observed\<bool\> |
| `outputs` | Output[] |

### Output (a controllable endpoint)
| Field | Type |
|---|---|
| `id`, `name` | "Front of room", "Rear of room", "Mains to projector", "Lecturer microphone", "PC audio" |
| `kind` | `switch \| level \| select \| position \| momentary` |
| `state` | Observed\<bool \| 0–100 \| enum\> |

### Derived states
- `ProjectorState`: `standby | warming_up | running | cooling_down | unknown`. From power (R1) plus the last IR command.
- `ScreenPosition`: `raised | lowered | moving | unknown`.
- `AcState`: `power: on|off`, `setpoint_c: int`. Always `assumed` or `unknown`.
- `AudioState`: per-channel level 0–100 (confirmed), `muted_all: bool`, `saved_levels` (for unmute).

### PowerReading
| Field | Type |
|---|---|
| `watts`, `volts` | number |
| `kwh_today` | number (reset at local midnight) |
| `rating_a` | 13 (static) |
| `at` | timestamp |

### SensorReading
| Field | Type |
|---|---|
| `kind` | `temperature \| humidity \| occupancy \| contact` |
| `value` | °C (1 dp) / % (int) / `detected\|clear` / `open\|closed` |
| `node` | ZigbeeNode ref |
| `at`, `stale` | |

### IrDevice / IrCommand
| IrDevice field | Type |
|---|---|
| `device` | Device ref |
| `brand` | string |
| `transport` | `ir_zs06 \| ir_mcu` |
| `commands` | IrCommand[] |

| IrCommand field | Type |
|---|---|
| `id` | |
| `name` | "Power on", "Power off", "24°", … |
| `role` | `power_on \| power_off \| setpoint \| other` |
| `setpoint` | `{ temp_c, mode, fan }` for AC frames |
| `code_format` | `tuya` |
| `code` | opaque string |
| `captured_at` | |
| `test` | `untested \| reacted \| no_reaction` |
| `tested_at` | |

### IrBlaster
`id` "ZS06", `topic` `r101_ir`, `lqi`, `coverage` "360°, 12 m", `power` `mains`, `online`.

### ZigbeeNode
| Field | Type |
|---|---|
| `ieee` | address |
| `friendly_name` | `r101_lights`, `r101_proj_plug`, `r101_temp`, … |
| `model` | `ZBM5-2C-86W`, `S60ZBTPG`, `SNZB-02P`, `SNZB-03P`, `SNZB-04PR2` |
| `role` | `router \| end_device` |
| `power_source` | `mains \| battery` |
| `lqi` | 0–255 |
| `battery_pct` | 0–100 or null |
| `last_seen` | timestamp |
| `online` | bool |

### Coordinator
`model` ZG-808Z, `chipset` CC2652P1, `firmware` "Z-Stack 3.x.0", `channel` 25, `tx_power_dbm` 20, `port` "zigbee-coord", `antenna` "SMA, external", `online`.

### Mesh
`paired`, `routers`, `end_devices`, `joining: closed | open(until)`.

### Interlock `[INFERRED]`
`status: armed | holding | bypassed`, `rule_text`.

### Command
| Field | Type |
|---|---|
| `id` | |
| `target` | Output / Device ref |
| `action` | `set \| on \| off \| select \| raise \| lower \| send_ir \| test_ir \| capture_ir` |
| `args` | |
| `issued_by` | ClientSession ref |
| `status` | `pending \| sent \| confirmed \| assumed \| failed \| timed_out` |
| `error` | string |
| `at` | |

### ClientSession
| Field | Type |
|---|---|
| `id` | |
| `client_type` | `kiosk \| remote` |
| `label` | `room screen \| phone \| tablet \| laptop \| podium PC` |
| `access` | `view \| control \| technician` |
| `unlocked_at`, `last_activity`, `expires_at` | |

### Schedule `[INFERRED]`
`class_blocks[]` (days, start, end); `actions[]` (name, time, days, enabled, steps).

---

## 7 Interactions & rules

### 7.1 Action → command → feedback

| User action | Command | Expected feedback | Confidence after | Failure / timeout |
|---|---|---|---|---|
| Tap source tile (S1.E11/12) | HDMI switch select input | Switch reports the selected input | confirmed (Q1) | H6 |
| Projector **Power on** (S1.E14) | IR "Power on" via ZS06 | Draw rises: warming up, then running >50 W | assumed → confirmed by draw | No draw change in 90 s: H7b warning |
| Projector **Power off** (S1.E15) | IR "Power off" via ZS06 | Draw falls: cooling down, then standby <5 W | assumed → confirmed by draw | Same |
| Screen **Raise/Lower** (S1.E18) | Screen raise/lower | Position report (Q2) | confirmed or assumed | H6 |
| Drag mic / PC slider (S1.E21/22) | Mixer set level 0–100 | Mixer reads back the level | confirmed | Thumb snaps back to the server value + H6a |
| **Mute all audio** (S1.E23) | Save levels, mute all channels | Mixer reads back mute | confirmed | H6 |
| Unmute all | Restore the saved levels | Read back | confirmed | H6 |
| Lights row toggle (S1.E32/33) | Zigbee set gang on/off | Switch reports state | confirmed | H6 |
| Wall plate pressed by hand | — | Switch reports state | confirmed, `changed_by: by hand` | — |
| AC **Power on** (S1.E35) | IR frame for current setpoint (frame includes power on) | None possible | assumed | Blaster error: H6 |
| AC **Power off** (S1.E36) | IR "Power off" frame | None | assumed | H6 |
| AC **−** / **+** | IR frame for the adjacent captured setpoint | None | assumed; setpoint updated | H6 |
| S1.E7 Settings | — | S4 then S3 | — | Wrong PIN: H17 after 5 |
| S3 **Test** | Send that IR code | Technician answers "Did it react?" | test = reacted / no_reaction | Blaster offline: H25 |
| S3 **Re-learn** | Put the blaster in learn mode | Code received within 20 s | captured, untested | H21 timeout |
| S3 "+ Add a command" | Create the command, then learn | as Re-learn | — | — |
| S3 "+ Add device" | Create IR device | Appears in list | — | Validation inline |
| Lock (S1.E8) | End session | Controls go to `view` | — | — |

### 7.2 Domain rules

- **R1 Projector state from draw.** >50 W = running; <5 W = standby. Between 5 W and 50 W = warming up or cooling down, depending on the last command or the direction of the change. The power reading turns the projector "from a guess into a fact".
- **R2 Projector control path.** Commanded over IR (ZS06). State is read back from the S60 power meter. IR success alone never marks it confirmed.
- **R3 AC is always assumed.** No feedback exists. The AC card stays dashed with the amber ring. It shows "Unknown" until the first command after a controller start.
- **R4 AC setpoints are separate captured frames.**
  - Each frame carries power + mode + temperature + fan.
  - **−/+ are not IR commands**: they step to the next lower or higher *captured* setpoint and send that full frame.
  - Setpoints that were never captured are skipped. The buttons disable at the ends of the captured range.
- **R5 Test every captured code.**
  - A new or re-learned code is "untested" until a technician confirms the hardware reacted.
  - Codes are never compared as text. The same button can return different strings.
  - S1 may send untested codes, but S3 flags them (H20).
- **R6 Lights read back.**
  - Switch state is always shown as confirmed from the switch.
  - Manual wall-plate changes appear on all clients with "· by hand".
  - The wall plate works even if the network is down.
- **R7 Mesh redundancy.** Battery sensors can route through either router (lighting switch or projector socket). One router offline → degraded, not fault (S2.E22).
- **R8 IR fallback.** A device's transport can be switched to `mcu` (ESP32 emitters on GPIO 16 and 17) through the room config. The UI shows "via ZS06" or "via MCU" accordingly.
- **R9 Mute all restores.** Mute saves each channel's level. Unmute restores them. Levels are read back after the restore.
- **R10 Source is exclusive.** Exactly one HDMI input is active.
- **R11 Shutdown interlock `[INFERRED]`.** Projector mains is not cut while draw ≥5 W (lamp cooling). Details: Q7.
- **R12 Server truth, last writer wins.** Clients render pushed state only. Conflicts resolve at the server in arrival order. Other clients get an attributed toast (H13).
- **R13 Staleness `[INFERRED]`.**
  - Periodic sensors (temperature/humidity, power) are stale after 2× their expected report interval.
  - Event sensors (occupancy, door) are stale when the node's last seen is more than 60 min ago.
- **R14 Access.** `view` sees everything on S1/S2. `control` operates S1. `technician` opens S3. The kiosk is always at least `control`. Session ends follow §2.3.
- **R15 Kiosk wake.** A tap that wakes the screen is consumed and never forwarded to a control.

---

## 8 Open questions

| ID | Question | Current assumption |
|---|---|---|
| Q1 | Which HDMI switch model is it, and how is the active input read back (serial, IP, CEC)? If there's no read-back, the tiles must use the assumed style. | Read back exists ("Selected, confirmed") |
| Q2 | What drives the projection screen (relay, IR, RF) and where does "Lowered" come from? Is there a Stop? | Two-state toggle, confirmed |
| Q4 | Is the ZS06 blaster counted in the Mesh (5 paired, 2 routers)? It says it "also routes for the battery sensors". It may be on another network or the mock-up may be wrong. | Unknown. Mesh shows what the coordinator reports. |
| Q5 | AC −/+ while AC is assumed Off: disable (current spec) or send the frame, which also powers the AC on? | Disabled while Off |
| Q7 | What does the Shutdown interlock card contain? Does any UI cut projector mains at all? | R11, S2.E23 minimal guess |
| Q8 | Exact mixer controls behind "Lecturer microphone" and "PC audio". Q8b: should dragging a slider while muted unmute everything, or only that channel? | Unmute all |
| Q12 | Expected report intervals per sensor model, and per-transport command timeouts. | 2× interval; 60 min for event sensors |
| Q13 | Will R-101 have a Pi touchscreen? It changes nothing in the spec, but the kiosk-only behaviour (§2.6) is unused without one. | Optional |
| Q19 | How is a client's attribution label chosen: from form factor automatically, or typed once at PIN entry (e.g. "Room 101 lecturer phone")? Can a desktop browser be told apart from the podium PC? | Automatic from form factor; podium PC marked by a one-time setting |
| Q22 | S3 count colour: is the green `14` / `2` "all tested", or just the captured count? | Captured count, amber if any are untested |
| Q23 | AC: what setpoint range and which mode/fan are captured (14 commands = power off + 13 setpoints?) | 13 setpoints, cool, auto fan |
| Q24 | Temperature unit °C fixed? | °C |
| Q25 | Do S3b–S3e need editing in v1, or display only? | Mostly display; PINs and schedule editable |
| Q26 | Should the occupancy/door sensors drive anything, such as auto-off when the room is empty? | No automation in v1 beyond kiosk wake |

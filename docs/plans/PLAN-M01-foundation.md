# PLAN-M01 — Foundation
Milestone: `docs/milestones/M01-foundation.md` · Start tag: `m01-start` · Verify-all: `pnpm verify`

Inputs read for this plan: M01, SPEC §2.2, §3.1–3.4, §4 (S1/S2 values), §6; ARCHITECTURE §1, §3, §4.1–4.2,
§8, §10; CLAUDE.md; `reference/screens/01-control-page.png`, `02-devices-zigbee.png.png`.

## Executor notes (read once, apply to every task)

- The repo has no code yet. Every path below is relative to the repo root `/home/rust-cohle/edcontrol`.
- **Toolchain decided by this plan** (checked on 2026-10-12 against the registry and a throw-away
  prototype). Do not change these versions:
  `typescript ~6.0.3` (TS 7 is out but `typescript-eslint` supports `<6.1`), `zod ^4.6.0`,
  `vitest ^5.0.0`, `vite ^8.0.0`, `@vitejs/plugin-react ^6.0.0`, `tailwindcss` + `@tailwindcss/vite ^4.3.0`,
  `react` / `react-dom ^19.2.0`, `eslint` + `@eslint/js ^10.0.0`, `typescript-eslint ^8.71.0`,
  `eslint-plugin-react-hooks ^7.1.0`, `tsx ^4.23.0`, `@types/node ^22.0.0`.
- pnpm is v11. Two v11 behaviours matter: (1) install **fails** on dependencies whose build scripts are
  not approved, so `pnpm-workspace.yaml` lists them under `allowBuilds`; (2) `pnpm -r <script>`
  **fails** if any package lacks the script, so root scripts use `--if-present`.
- `packages/contracts` imports use explicit `.ts` extensions (`from "../common.ts"`). This is
  allowed by `allowImportingTsExtensions` and keeps the package runnable by Node's type stripping
  later. Kiosk code imports with the `@/` alias and **no** extension.
- Every exported zod schema also gets a same-named type alias at the bottom of its file:
  `export type Room = z.infer<typeof Room>;`. The code blocks below already include them.
- Contract tests live in `packages/contracts/test/*.test.ts`. They import from `../src/...ts`.
- `verbatimModuleSyntax` is on: import types with `import type { … }` or `type` modifiers.
- If `pnpm install` prints `ERR_PNPM_IGNORED_BUILDS` for a package other than `esbuild`, do
  **not** run `pnpm approve-builds`; write a Blocker.
- Hardware fixture timestamps use the `Z` suffix (pydantic serialises UTC as `Z`; M07 round-trips them).

## File map

| File | Create/Modify | Responsibility |
|---|---|---|
| `package.json` | Create | Root scripts (`dev`, `build`, `typecheck`, `lint`, `test`, `verify`, `hw:*` stubs), root dev tooling |
| `pnpm-workspace.yaml` | Create | Workspace globs, `allowBuilds` |
| `tsconfig.base.json` | Create | Strict compiler options shared by all TS packages |
| `eslint.config.js` | Create | Flat config: typescript-eslint strict, `no-explicit-any: error`, hooks rules |
| `.gitignore`, `.editorconfig`, `.nvmrc` | Create | Repo hygiene, Node 22 pin |
| `packages/contracts/package.json`, `tsconfig.json`, `vitest.config.ts` | Create | Contracts package scaffold |
| `packages/contracts/src/index.ts` | Create, then Modify per task | Barrel export |
| `packages/contracts/src/common.ts` | Create | Timestamp, Confidence, Source, ClientLabel, ChangedBy, `observed()`, `Observed<T>`, AccessLevel, Level |
| `packages/contracts/src/domain/room.ts` | Create | Room, RoomStatus |
| `packages/contracts/src/domain/device.ts` | Create | DeviceKind, Transport, OutputKind, OutputId, Output, Device, DevicePatch |
| `packages/contracts/src/domain/display.ts` | Create | HdmiInput, ProjectorState, ScreenPosition, PowerReading, ProjectorFeedback |
| `packages/contracts/src/domain/audio.ts` | Create | AudioChannel, AudioState |
| `packages/contracts/src/domain/environment.ts` | Create | LightGang, AcState, SensorKind, SensorReading |
| `packages/contracts/src/domain/zigbee.ts` | Create | ZigbeeNode, Coordinator, Mesh |
| `packages/contracts/src/domain/interlock.ts` | Create | Interlock |
| `packages/contracts/src/domain/ir.ts` | Create | IrBlaster, IrTestStatus, IrSetpoint, IrCommandRole, IrCommand, IrCommandDetail, IrDeviceKind, IrTransport, IrDevice, IrCaptureStatus |
| `packages/contracts/src/domain/command.ts` | Create | CommandBody, CommandRequest, CommandStatus, Command |
| `packages/contracts/src/domain/session.ts` | Create | ClientType, ClientSession |
| `packages/contracts/src/domain/schedule.ts` | Create | Weekday, ClockTime, ClassBlock, TimedAction, Schedule |
| `packages/contracts/src/domain/system.ts` | Create | NetworkConnection, ConnectedClient, NetworkInfo, AboutInfo |
| `packages/contracts/src/state.ts` | Create | RoomState |
| `packages/contracts/src/api/{errors,session,state,commands,ir,schedule,devices,settings,system}.ts` | Create | REST request/response schemas |
| `packages/contracts/src/ws.ts` | Create | ServerEvent, ClientMessage |
| `packages/contracts/src/hw/{common,commands,data,snapshot,events,index}.ts` | Create | core-api ↔ hw-service contract |
| `packages/contracts/fixtures/state/room-normal.json` | Create | Golden RoomState = screenshots 01/02 |
| `packages/contracts/fixtures/hw/*.json` (31 files) | Create | One golden example per hw request/response/event |
| `packages/contracts/fixtures/README.md` | Create | Fixture naming rule (used by M07 pytest) |
| `packages/contracts/scripts/hw-json-schema.ts`, `scripts/export-hw-schema.ts` | Create | Build + write `generated/hw.schema.json` |
| `packages/contracts/generated/hw.schema.json` | Create (generated) | Committed JSON Schema of `hw/*` |
| `packages/contracts/test/*.test.ts`, `test/helpers.ts`, `test/hw-fixture-name.ts` | Create | Vitest |
| `apps/kiosk/package.json`, `index.html`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `.env.development` | Create | Kiosk scaffold |
| `apps/kiosk/src/main.tsx` | Create, then Modify | Entry |
| `apps/kiosk/src/styles/tokens.css` | Create | **Only** file with colour literals; Tailwind theme + shadcn mapping |
| `apps/kiosk/src/styles/index.css` | Create | Imports tokens, base styles |
| `apps/kiosk/src/styles/token-names.ts` (+ `.test.ts`) | Create | Token name lists used by the swatch page; test keeps them in sync with CSS |
| `apps/kiosk/components.json`, `apps/kiosk/src/lib/utils.ts` | Create | shadcn configuration (`ui/` path), `cn()` |
| `apps/kiosk/src/app/TokenSwatches.tsx` | Create | Temporary `/` page |
| `apps/kiosk/src/{ui,components,features/*,data/*}/.gitkeep` | Create | Folder skeleton (ARCHITECTURE §1) |
| `apps/core-api/package.json`, `apps/core-api/src/.gitkeep`, `services/hw/.gitkeep` | Create | Empty placeholders + script stubs |

## Tasks

### T1 — Root workspace and tooling
- [x] done

**Files:** `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `eslint.config.js`, `.gitignore`,
`.editorconfig`, `.nvmrc`

**Context:** M01 Scope "Root"; ARCHITECTURE §1, §8 ("The one command"), D-14. `hw:check`, `hw:lint`,
`hw:test` are no-op stubs that M07 replaces.

**Do:**
1. Create `package.json`:
   ```json
   {
     "name": "eduscope-central",
     "version": "0.0.0",
     "private": true,
     "type": "module",
     "packageManager": "pnpm@11.28.3",
     "engines": { "node": ">=22" },
     "scripts": {
       "dev": "pnpm -r --parallel --if-present dev",
       "build": "pnpm -r --if-present build",
       "typecheck": "pnpm -r --if-present typecheck",
       "lint": "eslint .",
       "test": "pnpm -r --if-present test",
       "hw:check": "node -e \"console.log('hw:check: no-op until M07 (ruff + pytest)')\"",
       "hw:lint": "node -e \"console.log('hw:lint: no-op until M07')\"",
       "hw:test": "node -e \"console.log('hw:test: no-op until M07')\"",
       "verify": "pnpm typecheck && pnpm lint && pnpm test && pnpm hw:check"
     }
   }
   ```
2. Create `pnpm-workspace.yaml`:
   ```yaml
   packages:
     - apps/*
     - packages/*
   allowBuilds:
     esbuild: true
   ```
3. Create `tsconfig.base.json`:
   ```json
   {
     "compilerOptions": {
       "target": "ES2022",
       "lib": ["ES2023"],
       "module": "ESNext",
       "moduleResolution": "Bundler",
       "moduleDetection": "force",
       "resolveJsonModule": true,
       "isolatedModules": true,
       "verbatimModuleSyntax": true,
       "allowImportingTsExtensions": true,
       "strict": true,
       "noUncheckedIndexedAccess": true,
       "exactOptionalPropertyTypes": true,
       "noImplicitOverride": true,
       "noFallthroughCasesInSwitch": true,
       "noUnusedLocals": true,
       "noUnusedParameters": true,
       "forceConsistentCasingInFileNames": true,
       "skipLibCheck": true,
       "noEmit": true
     }
   }
   ```
4. Install root dev tooling:
   `pnpm add -Dw eslint@^10.0.0 @eslint/js@^10.0.0 typescript-eslint@^8.71.0 eslint-plugin-react-hooks@^7.1.0 typescript@~6.0.3`
5. Create `eslint.config.js`:
   ```js
   import { defineConfig } from "eslint/config";
   import js from "@eslint/js";
   import reactHooks from "eslint-plugin-react-hooks";
   import tseslint from "typescript-eslint";

   export default defineConfig(
     {
       ignores: [
         "**/node_modules/**",
         "**/dist/**",
         "**/generated/**",
         "reference/**",
         "refrenced-guide/**",
         "guide/**",
         "docs/**",
         "services/**",
       ],
     },
     js.configs.recommended,
     tseslint.configs.strict,
     {
       files: ["**/*.{ts,tsx}"],
       plugins: { "react-hooks": reactHooks },
       rules: {
         "@typescript-eslint/no-explicit-any": "error",
         "react-hooks/rules-of-hooks": "error",
         "react-hooks/exhaustive-deps": "error",
       },
     },
   );
   ```
6. Create `.gitignore`:
   ```
   node_modules/
   dist/
   coverage/
   *.tsbuildinfo
   .vite/
   # env: secrets never committed; apps/kiosk/.env.development (non-secret) IS committed
   .env
   .env.local
   .env.*.local
   deploy/pi/env/*.env
   # SQLite
   *.db
   *.db-wal
   *.db-shm
   *.sqlite
   # python
   .venv/
   __pycache__/
   .pytest_cache/
   .ruff_cache/
   .DS_Store
   ```
7. Create `.editorconfig`:
   ```
   root = true

   [*]
   charset = utf-8
   end_of_line = lf
   insert_final_newline = true
   indent_style = space
   indent_size = 2
   trim_trailing_whitespace = true

   [*.py]
   indent_size = 4

   [*.md]
   trim_trailing_whitespace = false
   ```
8. Create `.nvmrc` containing exactly `22` and a newline.

**Verify:** `pnpm install && pnpm verify` → exits 0. Typecheck/test print "No projects matched"
(no packages yet), `eslint .` prints nothing, `hw:check` prints its no-op line.

**Commit:** `git commit -m "chore: pnpm workspace and root tooling"`

---

### T2 — Contracts package scaffold
- [x] done

**Files:** `packages/contracts/package.json`, `packages/contracts/tsconfig.json`,
`packages/contracts/vitest.config.ts`, `packages/contracts/src/index.ts`, `packages/contracts/test/helpers.ts`

**Context:** ARCHITECTURE §1 (`packages/contracts` — zod v4, no runtime deps besides zod), §3.1.
Consumers import TypeScript source directly (`exports` → `src/index.ts`); `build` is a type check.

**Do:**
1. Create `packages/contracts/package.json`:
   ```json
   {
     "name": "@eduscope/contracts",
     "version": "0.0.0",
     "private": true,
     "type": "module",
     "exports": { ".": "./src/index.ts" },
     "scripts": {
       "build": "tsc -p tsconfig.json",
       "typecheck": "tsc -p tsconfig.json",
       "test": "vitest run"
     }
   }
   ```
2. `pnpm --filter @eduscope/contracts add zod@^4.6.0`
3. `pnpm --filter @eduscope/contracts add -D typescript@~6.0.3 vitest@^5.0.0 tsx@^4.23.0 @types/node@^22.0.0`
4. Create `packages/contracts/tsconfig.json`:
   ```json
   {
     "extends": "../../tsconfig.base.json",
     "compilerOptions": { "types": ["node"] },
     "include": ["src", "test", "scripts", "vitest.config.ts"]
   }
   ```
5. Create `packages/contracts/vitest.config.ts`:
   ```ts
   import { defineConfig } from "vitest/config";

   export default defineConfig({
     test: { include: ["test/**/*.test.ts"], environment: "node", passWithNoTests: true },
   });
   ```
6. Create `packages/contracts/src/index.ts` with exactly `export {};`.
7. Create `packages/contracts/test/helpers.ts`:
   ```ts
   /** Fixed server time used by every contract test (screenshot clock: Mon 5 Oct, 10:42). */
   export const AT = "2026-10-05T10:42:00Z";

   /** A complete Observed<T> wire object; override any field to build a bad sample. */
   export function obs(value: unknown, overrides: Record<string, unknown> = {}): Record<string, unknown> {
     return {
       value,
       confidence: "confirmed",
       source: "switch",
       updated_at: AT,
       stale: false,
       changed_by: null,
       ...overrides,
     };
   }
   ```

**Verify:** `pnpm install && pnpm --filter @eduscope/contracts typecheck && pnpm verify` → exit 0
("No test files found, exiting with code 0" is fine).

**Commit:** `git commit -m "chore(contracts): package scaffold"`

---

### T3 — `common.ts`: Observed and shared primitives
- [x] done

**Files:** `packages/contracts/src/common.ts`, `packages/contracts/src/index.ts`,
`packages/contracts/test/common.test.ts`

**Context:** ARCHITECTURE §3.2 (common.ts, verbatim), SPEC §6 Observed<T>; M01 note: `observed()` is a
generic factory plus a hand-written `Observed<T>`. M01 AC4: "`observed()` rejects a missing `confidence`".

**Do:**
1. Create `packages/contracts/src/common.ts`:
   ```ts
   import { z } from "zod";

   export const Timestamp = z.iso.datetime({ offset: true });

   export const Confidence = z.enum(["confirmed", "assumed", "unknown"]);
   export const Source = z.enum([
     "switch", "power_meter", "hdmi_switch", "mixer", "ir", "sensor", "manual", "none",
   ]);
   export const ClientLabel = z.enum(["room screen", "phone", "tablet", "laptop", "podium PC"]);
   export const ChangedBy = z.union([ClientLabel, z.literal("by hand"), z.literal("schedule")]);

   /** Wraps every hardware value: what the server believes and how sure it is. */
   export const observed = <T extends z.ZodType>(value: T) =>
     z.object({
       value: value.nullable(),
       confidence: Confidence,
       source: Source,
       updated_at: Timestamp.nullable(), // null = never reported (H11)
       stale: z.boolean(), // computed by core-api (R13)
       changed_by: ChangedBy.nullable(),
     });

   /** Hand-written twin of z.infer<ReturnType<typeof observed>> so components can be generic. */
   export type Observed<T> = {
     value: T | null;
     confidence: z.infer<typeof Confidence>;
     source: z.infer<typeof Source>;
     updated_at: string | null;
     stale: boolean;
     changed_by: z.infer<typeof ChangedBy> | null;
   };

   export const AccessLevel = z.enum(["view", "control", "technician"]);
   export const Level = z.number().int().min(0).max(100);

   export type Timestamp = z.infer<typeof Timestamp>;
   export type Confidence = z.infer<typeof Confidence>;
   export type Source = z.infer<typeof Source>;
   export type ClientLabel = z.infer<typeof ClientLabel>;
   export type ChangedBy = z.infer<typeof ChangedBy>;
   export type AccessLevel = z.infer<typeof AccessLevel>;
   export type Level = z.infer<typeof Level>;
   ```
2. Replace `packages/contracts/src/index.ts` content with:
   ```ts
   export * from "./common.ts";
   ```

**Test:** `packages/contracts/test/common.test.ts`
```ts
import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";
import { AccessLevel, ChangedBy, Level, observed, Timestamp, type Observed } from "../src/common.ts";
import { AT, obs } from "./helpers.ts";

const ObservedBool = observed(z.boolean());

describe("Timestamp", () => {
  it("accepts ISO-8601 with Z or an offset", () => {
    expect(Timestamp.safeParse(AT).success).toBe(true);
    expect(Timestamp.safeParse("2026-10-05T10:42:00+02:00").success).toBe(true);
  });
  it("rejects a timestamp without offset", () => {
    expect(Timestamp.safeParse("2026-10-05T10:42:00").success).toBe(false);
  });
});

describe("observed()", () => {
  it("accepts a complete observed value", () => {
    expect(ObservedBool.safeParse(obs(true)).success).toBe(true);
  });
  it("accepts a never-reported value (H11)", () => {
    const never = obs(null, { confidence: "unknown", source: "none", updated_at: null });
    expect(ObservedBool.safeParse(never).success).toBe(true);
  });
  it("rejects a missing confidence", () => {
    const sample = obs(true);
    delete sample.confidence;
    expect(ObservedBool.safeParse(sample).success).toBe(false);
  });
  it("rejects a value of the wrong type", () => {
    expect(ObservedBool.safeParse(obs("yes")).success).toBe(false);
  });
  it("rejects an unknown confidence", () => {
    expect(ObservedBool.safeParse(obs(true, { confidence: "maybe" })).success).toBe(false);
  });
  it("matches the hand-written Observed<T>", () => {
    expectTypeOf<z.infer<typeof ObservedBool>>().toEqualTypeOf<Observed<boolean>>();
  });
});

describe("ChangedBy", () => {
  it.each(["phone", "podium PC", "by hand", "schedule"])("accepts %s", (label) => {
    expect(ChangedBy.safeParse(label).success).toBe(true);
  });
  it("rejects an unknown label", () => {
    expect(ChangedBy.safeParse("desktop").success).toBe(false);
  });
});

describe("Level and AccessLevel", () => {
  it("accepts 0 and 100, rejects 101 and 1.5", () => {
    expect(Level.safeParse(0).success).toBe(true);
    expect(Level.safeParse(100).success).toBe(true);
    expect(Level.safeParse(101).success).toBe(false);
    expect(Level.safeParse(1.5).success).toBe(false);
  });
  it("rejects an unknown access level", () => {
    expect(AccessLevel.safeParse("technician").success).toBe(true);
    expect(AccessLevel.safeParse("admin").success).toBe(false);
  });
});
```

**Verify:** `pnpm --filter @eduscope/contracts test` → `common.test.ts` 15 passed; `pnpm verify` green.

**Commit:** `git commit -m "feat(contracts): common primitives and observed()"`

---

### T4 — Domain: room and device registry
- [x] done

**Files:** `packages/contracts/src/domain/room.ts`, `packages/contracts/src/domain/device.ts`,
`packages/contracts/src/index.ts`, `packages/contracts/test/device.test.ts`

**Context:** ARCHITECTURE §3.2 (Room, Device…), §3.3 (`DevicePatch`); SPEC §6 Room/Device/Output, S3d
(rename, change transport, hardware id).

**Do:**
1. Create `packages/contracts/src/domain/room.ts`:
   ```ts
   import { z } from "zod";

   export const RoomStatus = z.object({
     level: z.enum(["normal", "degraded", "fault"]),
     text: z.string(), // "All systems normal"
   });
   export const Room = z.object({
     id: z.string(), // "R-101"
     hostname: z.string(), // "r-101.local"
     status: RoomStatus,
   });

   export type RoomStatus = z.infer<typeof RoomStatus>;
   export type Room = z.infer<typeof Room>;
   ```
2. Create `packages/contracts/src/domain/device.ts`:
   ```ts
   import { z } from "zod";
   import { observed } from "../common.ts";

   export const DeviceKind = z.enum([
     "projector", "hdmi_switch", "projection_screen", "lights", "ac", "audio",
     "power_socket", "sensor", "ir_blaster", "coordinator", "other", // "other": S3.E9
   ]);
   export const Transport = z.enum(["zigbee", "ir_zs06", "ir_mcu", "local"]);
   export const OutputKind = z.enum(["switch", "level", "select", "position", "momentary"]);
   export const OutputId = z.enum([
     "display.source", "projector.ir", "projector.mains", "screen", "audio.mic", "audio.pc",
     "lights.front", "lights.rear", "ac",
   ]);
   export const Output = z.object({ id: OutputId, name: z.string(), kind: OutputKind });
   export const Device = z.object({
     id: z.string(),
     name: z.string(),
     kind: DeviceKind,
     transport: Transport,
     brand: z.string().nullable(),
     model: z.string().nullable(),
     hw_ref: z.string().nullable(), // z2m friendly name, port, …
     online: observed(z.boolean()),
     outputs: z.array(Output),
   });
   /** S3d edit sheet: rename, change transport, change hardware id. Every field is optional. */
   export const DevicePatch = z.object({
     name: z.string().trim().min(1).max(40).optional(),
     transport: Transport.optional(),
     hw_ref: z.string().trim().min(1).nullable().optional(),
   });

   export type DeviceKind = z.infer<typeof DeviceKind>;
   export type Transport = z.infer<typeof Transport>;
   export type OutputKind = z.infer<typeof OutputKind>;
   export type OutputId = z.infer<typeof OutputId>;
   export type Output = z.infer<typeof Output>;
   export type Device = z.infer<typeof Device>;
   export type DevicePatch = z.infer<typeof DevicePatch>;
   ```
3. Append to `packages/contracts/src/index.ts`:
   ```ts
   export * from "./domain/room.ts";
   export * from "./domain/device.ts";
   ```

**Test:** `packages/contracts/test/device.test.ts`
```ts
import { describe, expect, it } from "vitest";
import { Device, DeviceKind, DevicePatch, OutputId } from "../src/domain/device.ts";
import { Room } from "../src/domain/room.ts";
import { obs } from "./helpers.ts";

const lights = {
  id: "lights",
  name: "Lighting switch",
  kind: "lights",
  transport: "zigbee",
  brand: null,
  model: "ZBM5-2C-86W",
  hw_ref: "r101_lights",
  online: obs(true),
  outputs: [
    { id: "lights.front", name: "Front of room", kind: "switch" },
    { id: "lights.rear", name: "Rear of room", kind: "switch" },
  ],
};

describe("Room", () => {
  it("accepts R-101 in normal status", () => {
    const room = { id: "R-101", hostname: "r-101.local", status: { level: "normal", text: "All systems normal" } };
    expect(Room.safeParse(room).success).toBe(true);
  });
  it("rejects an unknown status level", () => {
    const room = { id: "R-101", hostname: "r-101.local", status: { level: "ok", text: "" } };
    expect(Room.safeParse(room).success).toBe(false);
  });
});

describe("Device", () => {
  it("accepts the lighting switch", () => {
    expect(Device.safeParse(lights).success).toBe(true);
  });
  it("rejects an unknown transport", () => {
    expect(Device.safeParse({ ...lights, transport: "wifi" }).success).toBe(false);
  });
  it("accepts kind other (S3.E9)", () => {
    expect(DeviceKind.safeParse("other").success).toBe(true);
  });
  it("rejects an unknown output id", () => {
    expect(OutputId.safeParse("lights.middle").success).toBe(false);
  });
});

describe("DevicePatch", () => {
  it("accepts an empty patch and a rename + transport change", () => {
    expect(DevicePatch.safeParse({}).success).toBe(true);
    expect(DevicePatch.safeParse({ name: "Projector 2", transport: "ir_mcu" }).success).toBe(true);
  });
  it("rejects a blank name", () => {
    expect(DevicePatch.safeParse({ name: "   " }).success).toBe(false);
  });
});
```

**Verify:** `pnpm --filter @eduscope/contracts test` → `device.test.ts` 8 passed; `pnpm verify` green.

**Commit:** `git commit -m "feat(contracts): room and device schemas"`

---

### T5 — Domain: display and audio
- [x] done

**Files:** `packages/contracts/src/domain/display.ts`, `packages/contracts/src/domain/audio.ts`,
`packages/contracts/src/index.ts`, `packages/contracts/test/display-audio.test.ts`

**Context:** ARCHITECTURE §3.2; SPEC §6 PowerReading, Derived states, R1, R9, H7b.

**Do:**
1. Create `packages/contracts/src/domain/display.ts`:
   ```ts
   import { z } from "zod";
   import { Timestamp } from "../common.ts";

   export const HdmiInput = z.enum(["podium_pc", "smart_board"]);
   export const ProjectorState = z.enum(["standby", "warming_up", "running", "cooling_down", "unknown"]);
   export const ScreenPosition = z.enum(["raised", "lowered", "moving", "unknown"]);
   export const PowerReading = z.object({
     watts: z.number(),
     volts: z.number(),
     kwh_today: z.number(),
     rating_a: z.number(),
     at: Timestamp,
   });
   export const ProjectorFeedback = z.object({ // H7b
     last_ir: z.enum(["power_on", "power_off"]).nullable(),
     sent_at: Timestamp.nullable(),
     phase: z.enum(["idle", "waiting_for_draw", "no_change"]),
   });

   export type HdmiInput = z.infer<typeof HdmiInput>;
   export type ProjectorState = z.infer<typeof ProjectorState>;
   export type ScreenPosition = z.infer<typeof ScreenPosition>;
   export type PowerReading = z.infer<typeof PowerReading>;
   export type ProjectorFeedback = z.infer<typeof ProjectorFeedback>;
   ```
2. Create `packages/contracts/src/domain/audio.ts`:
   ```ts
   import { z } from "zod";
   import { Level, observed } from "../common.ts";

   export const AudioChannel = z.enum(["mic", "pc"]);
   export const AudioState = z.object({
     channels: z.object({ mic: observed(Level), pc: observed(Level) }),
     muted_all: observed(z.boolean()),
     saved_levels: z.object({ mic: Level.nullable(), pc: Level.nullable() }), // R9
   });

   export type AudioChannel = z.infer<typeof AudioChannel>;
   export type AudioState = z.infer<typeof AudioState>;
   ```
3. Append to `index.ts`: `export * from "./domain/display.ts";` and `export * from "./domain/audio.ts";`

**Test:** `packages/contracts/test/display-audio.test.ts`
```ts
import { describe, expect, it } from "vitest";
import { AudioState } from "../src/domain/audio.ts";
import { PowerReading, ProjectorFeedback, ProjectorState } from "../src/domain/display.ts";
import { AT, obs } from "./helpers.ts";

const audio = {
  channels: { mic: obs(62, { source: "mixer" }), pc: obs(38, { source: "mixer" }) },
  muted_all: obs(false, { source: "mixer" }),
  saved_levels: { mic: null, pc: null },
};

describe("display", () => {
  it("accepts the screenshot power reading", () => {
    const reading = { watts: 287, volts: 231, kwh_today: 1.84, rating_a: 13, at: AT };
    expect(PowerReading.safeParse(reading).success).toBe(true);
  });
  it("rejects a power reading without a timestamp", () => {
    expect(PowerReading.safeParse({ watts: 287, volts: 231, kwh_today: 1.84, rating_a: 13 }).success).toBe(false);
  });
  it("rejects a projector state outside R1", () => {
    expect(ProjectorState.safeParse("on").success).toBe(false);
  });
  it("accepts idle feedback and rejects an unknown phase", () => {
    expect(ProjectorFeedback.safeParse({ last_ir: null, sent_at: null, phase: "idle" }).success).toBe(true);
    expect(ProjectorFeedback.safeParse({ last_ir: null, sent_at: null, phase: "warming" }).success).toBe(false);
  });
});

describe("AudioState", () => {
  it("accepts mic 62 / pc 38", () => {
    expect(AudioState.safeParse(audio).success).toBe(true);
  });
  it("rejects a level above 100", () => {
    const loud = { ...audio, channels: { ...audio.channels, mic: obs(101, { source: "mixer" }) } };
    expect(AudioState.safeParse(loud).success).toBe(false);
  });
});
```

**Verify:** `pnpm --filter @eduscope/contracts test` → `display-audio.test.ts` 6 passed; `pnpm verify` green.

**Commit:** `git commit -m "feat(contracts): display and audio schemas"`

---

### T6 — Domain: environment (lights, AC, sensors)
- [ ] done

**Files:** `packages/contracts/src/domain/environment.ts`, `packages/contracts/src/index.ts`,
`packages/contracts/test/environment.test.ts`

**Context:** ARCHITECTURE §3.2; SPEC §6 SensorReading, R3, R4. M01 AC4: "`SensorReading` rejects
`{kind:"occupancy", value:"open"}`" — the test sends a full reading (with `node`, `at`, `stale`) so it
fails **because of the value**, not because fields are missing.

**Do:**
1. Create `packages/contracts/src/domain/environment.ts`:
   ```ts
   import { z } from "zod";
   import { observed, Timestamp } from "../common.ts";

   export const LightGang = z.enum(["front", "rear"]);
   export const AcState = z.object({ // R3: never "confirmed"
     power: observed(z.enum(["on", "off"])),
     setpoint_c: observed(z.number().int()),
     available_setpoints: z.array(z.number().int()), // R4: captured frames only, ascending
   });

   export const SensorKind = z.enum(["temperature", "humidity", "occupancy", "contact"]);
   export const SensorReading = z
     .discriminatedUnion("kind", [
       z.object({ kind: z.literal("temperature"), value: z.number().nullable() }),
       z.object({ kind: z.literal("humidity"), value: z.number().int().nullable() }),
       z.object({ kind: z.literal("occupancy"), value: z.enum(["detected", "clear"]).nullable() }),
       z.object({ kind: z.literal("contact"), value: z.enum(["open", "closed"]).nullable() }),
     ])
     .and(z.object({ node: z.string(), at: Timestamp.nullable(), stale: z.boolean() }));

   export type LightGang = z.infer<typeof LightGang>;
   export type AcState = z.infer<typeof AcState>;
   export type SensorKind = z.infer<typeof SensorKind>;
   export type SensorReading = z.infer<typeof SensorReading>;
   ```
2. Append to `index.ts`: `export * from "./domain/environment.ts";`

**Test:** `packages/contracts/test/environment.test.ts`
```ts
import { describe, expect, it } from "vitest";
import { AcState, SensorReading } from "../src/domain/environment.ts";
import { AT, obs } from "./helpers.ts";

const meta = { at: AT, stale: false };

describe("SensorReading", () => {
  it.each([
    { kind: "temperature", value: 26.4, node: "r101_temp" },
    { kind: "humidity", value: 61, node: "r101_temp" },
    { kind: "occupancy", value: "detected", node: "r101_motion" },
    { kind: "contact", value: "closed", node: "r101_door" },
    { kind: "contact", value: null, node: "r101_door" },
  ])("accepts $kind = $value", (reading) => {
    expect(SensorReading.safeParse({ ...reading, ...meta }).success).toBe(true);
  });
  it('rejects {kind:"occupancy", value:"open"}', () => {
    expect(SensorReading.safeParse({ kind: "occupancy", value: "open", node: "r101_motion", ...meta }).success).toBe(false);
  });
  it("rejects a fractional humidity", () => {
    expect(SensorReading.safeParse({ kind: "humidity", value: 61.5, node: "r101_temp", ...meta }).success).toBe(false);
  });
  it("rejects a reading without node", () => {
    expect(SensorReading.safeParse({ kind: "temperature", value: 26.4, ...meta }).success).toBe(false);
  });
});

describe("AcState", () => {
  const ac = {
    power: obs("on", { confidence: "assumed", source: "ir" }),
    setpoint_c: obs(24, { confidence: "assumed", source: "ir" }),
    available_setpoints: [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
  };
  it("accepts On · assumed at 24°", () => {
    expect(AcState.safeParse(ac).success).toBe(true);
  });
  it("rejects a fractional setpoint", () => {
    expect(AcState.safeParse({ ...ac, setpoint_c: obs(24.5, { confidence: "assumed", source: "ir" }) }).success).toBe(false);
  });
});
```

**Verify:** `pnpm --filter @eduscope/contracts test` → `environment.test.ts` 10 passed (5 `each` + 5); `pnpm verify` green.

**Commit:** `git commit -m "feat(contracts): environment schemas"`

---

### T7 — Domain: zigbee mesh and interlock
- [ ] done

**Files:** `packages/contracts/src/domain/zigbee.ts`, `packages/contracts/src/domain/interlock.ts`,
`packages/contracts/src/index.ts`, `packages/contracts/test/zigbee.test.ts`

**Context:** ARCHITECTURE §3.2; SPEC §6 ZigbeeNode/Coordinator/Mesh/Interlock; S2.E20–E23.

**Do:**
1. Create `packages/contracts/src/domain/zigbee.ts`:
   ```ts
   import { z } from "zod";
   import { Timestamp } from "../common.ts";

   export const ZigbeeNode = z.object({
     ieee: z.string(),
     friendly_name: z.string(),
     model: z.string(),
     role: z.enum(["router", "end_device"]),
     power_source: z.enum(["mains", "battery"]),
     lqi: z.number().int().min(0).max(255).nullable(),
     battery_pct: z.number().int().min(0).max(100).nullable(),
     last_seen: Timestamp.nullable(),
     online: z.boolean(),
   });
   export const Coordinator = z.object({
     model: z.string(),
     chipset: z.string(),
     firmware: z.string(),
     channel: z.number().int(),
     tx_power_dbm: z.number(),
     port: z.string(),
     antenna: z.string(),
     status: z.enum(["online", "offline", "starting"]),
   });
   export const Mesh = z.object({
     paired: z.number().int(),
     routers: z.number().int(),
     end_devices: z.number().int(),
     joining: z.discriminatedUnion("state", [
       z.object({ state: z.literal("closed") }),
       z.object({ state: z.literal("open"), until: Timestamp }),
     ]),
   });

   export type ZigbeeNode = z.infer<typeof ZigbeeNode>;
   export type Coordinator = z.infer<typeof Coordinator>;
   export type Mesh = z.infer<typeof Mesh>;
   ```
2. Create `packages/contracts/src/domain/interlock.ts`:
   ```ts
   import { z } from "zod";

   export const Interlock = z.object({ // R11, Q7
     status: z.enum(["armed", "holding", "bypassed"]),
     rule_text: z.string(),
   });

   export type Interlock = z.infer<typeof Interlock>;
   ```
3. Append to `index.ts`: `export * from "./domain/zigbee.ts";` and `export * from "./domain/interlock.ts";`

**Test:** `packages/contracts/test/zigbee.test.ts`
```ts
import { describe, expect, it } from "vitest";
import { Interlock } from "../src/domain/interlock.ts";
import { Coordinator, Mesh, ZigbeeNode } from "../src/domain/zigbee.ts";
import { AT } from "./helpers.ts";

const lightsNode = {
  ieee: "0xa4c1380f2b9e0001",
  friendly_name: "r101_lights",
  model: "ZBM5-2C-86W",
  role: "router",
  power_source: "mains",
  lqi: 214,
  battery_pct: null,
  last_seen: AT,
  online: true,
};

describe("zigbee", () => {
  it("accepts the lighting switch node", () => {
    expect(ZigbeeNode.safeParse(lightsNode).success).toBe(true);
  });
  it("rejects an LQI above 255", () => {
    expect(ZigbeeNode.safeParse({ ...lightsNode, lqi: 256 }).success).toBe(false);
  });
  it("accepts the ZG-808Z coordinator", () => {
    const coordinator = {
      model: "ZG-808Z", chipset: "CC2652P1", firmware: "Z-Stack 3.x.0", channel: 25,
      tx_power_dbm: 20, port: "zigbee-coord", antenna: "SMA, external", status: "online",
    };
    expect(Coordinator.safeParse(coordinator).success).toBe(true);
  });
  it("requires `until` only when joining is open", () => {
    const base = { paired: 5, routers: 2, end_devices: 3 };
    expect(Mesh.safeParse({ ...base, joining: { state: "closed" } }).success).toBe(true);
    expect(Mesh.safeParse({ ...base, joining: { state: "open", until: AT } }).success).toBe(true);
    expect(Mesh.safeParse({ ...base, joining: { state: "open" } }).success).toBe(false);
  });
  it("rejects an unknown interlock status", () => {
    expect(Interlock.safeParse({ status: "armed", rule_text: "x" }).success).toBe(true);
    expect(Interlock.safeParse({ status: "off", rule_text: "x" }).success).toBe(false);
  });
});
```

**Verify:** `pnpm --filter @eduscope/contracts test` → `zigbee.test.ts` 5 passed; `pnpm verify` green.

**Commit:** `git commit -m "feat(contracts): zigbee and interlock schemas"`

---

### T8 — Domain: IR devices and commands
- [ ] done

**Files:** `packages/contracts/src/domain/ir.ts`, `packages/contracts/src/index.ts`,
`packages/contracts/test/ir.test.ts`

**Context:** ARCHITECTURE §3.2 (IrBlaster, IrCommand, IrDevice), §3.3 (`IrCommandDetail (+code)`,
`IrSetpoint`, `IrCaptureStatus`); SPEC §6 IrDevice/IrCommand, R4, R5, H21. The opaque `code` exists only in
`IrCommandDetail` (technician-only, never on WS).

**Do:**
1. Create `packages/contracts/src/domain/ir.ts`:
   ```ts
   import { z } from "zod";
   import { observed, Timestamp } from "../common.ts";

   export const IrBlaster = z.object({
     id: z.string(),
     topic: z.string(),
     lqi: z.number().int().nullable(),
     coverage: z.string(),
     power: z.literal("mains"),
     online: observed(z.boolean()),
   });

   export const IrTestStatus = z.enum(["untested", "reacted", "no_reaction"]);
   /** One captured AC state frame (R4): power + mode + temperature + fan. */
   export const IrSetpoint = z.object({
     temp_c: z.number().int(),
     mode: z.string().min(1),
     fan: z.string().min(1),
   });
   export const IrCommandRole = z.enum(["power_on", "power_off", "setpoint", "other"]);
   export const IrCommand = z.object({
     id: z.string(),
     device_id: z.string(),
     name: z.string(),
     role: IrCommandRole,
     setpoint: IrSetpoint.nullable(),
     code_format: z.literal("tuya"),
     captured: z.boolean(), // the code itself is technician-only (IrCommandDetail)
     captured_at: Timestamp.nullable(),
     test: IrTestStatus,
     tested_at: Timestamp.nullable(),
   });
   /** Technician-only view of a command, including the opaque code. Never sent over WS. */
   export const IrCommandDetail = IrCommand.extend({ code: z.string().nullable() });

   export const IrDeviceKind = z.enum(["projector", "ac", "other"]);
   export const IrTransport = z.enum(["ir_zs06", "ir_mcu"]);
   export const IrDevice = z.object({ // a Device whose transport is ir_*
     device_id: z.string(),
     name: z.string(),
     brand: z.string(),
     kind: IrDeviceKind,
     transport: IrTransport,
     commands: z.array(IrCommand),
   });

   /** Capture flow states pushed over WS as `ir_capture` (H21). */
   export const IrCaptureStatus = z.enum(["listening", "captured", "timeout", "cancelled", "failed"]);

   export type IrBlaster = z.infer<typeof IrBlaster>;
   export type IrTestStatus = z.infer<typeof IrTestStatus>;
   export type IrSetpoint = z.infer<typeof IrSetpoint>;
   export type IrCommandRole = z.infer<typeof IrCommandRole>;
   export type IrCommand = z.infer<typeof IrCommand>;
   export type IrCommandDetail = z.infer<typeof IrCommandDetail>;
   export type IrDeviceKind = z.infer<typeof IrDeviceKind>;
   export type IrTransport = z.infer<typeof IrTransport>;
   export type IrDevice = z.infer<typeof IrDevice>;
   export type IrCaptureStatus = z.infer<typeof IrCaptureStatus>;
   ```
2. Append to `index.ts`: `export * from "./domain/ir.ts";`

**Test:** `packages/contracts/test/ir.test.ts`
```ts
import { describe, expect, it } from "vitest";
import { IrCaptureStatus, IrCommand, IrCommandDetail, IrDevice } from "../src/domain/ir.ts";
import { AT } from "./helpers.ts";

const powerOn = {
  id: "cmd_proj_on",
  device_id: "projector",
  name: "Power on",
  role: "power_on",
  setpoint: null,
  code_format: "tuya",
  captured: true,
  captured_at: AT,
  test: "reacted",
  tested_at: AT,
};

describe("IR", () => {
  it("accepts a captured, tested projector command", () => {
    expect(IrCommand.safeParse(powerOn).success).toBe(true);
  });
  it("accepts an AC setpoint frame", () => {
    const frame = { ...powerOn, id: "cmd_ac_24", device_id: "ac", name: "24°", role: "setpoint",
      setpoint: { temp_c: 24, mode: "cool", fan: "auto" }, test: "untested", tested_at: null };
    expect(IrCommand.safeParse(frame).success).toBe(true);
  });
  it("IrCommandDetail requires the code key (null allowed)", () => {
    expect(IrCommandDetail.safeParse(powerOn).success).toBe(false);
    expect(IrCommandDetail.safeParse({ ...powerOn, code: null }).success).toBe(true);
  });
  it("rejects a non-IR transport on an IR device", () => {
    const device = { device_id: "projector", name: "Projector", brand: "Epson", kind: "projector",
      transport: "zigbee", commands: [powerOn] };
    expect(IrDevice.safeParse(device).success).toBe(false);
    expect(IrDevice.safeParse({ ...device, transport: "ir_zs06" }).success).toBe(true);
  });
  it("capture status includes failed", () => {
    expect(IrCaptureStatus.safeParse("failed").success).toBe(true);
  });
});
```

**Verify:** `pnpm --filter @eduscope/contracts test` → `ir.test.ts` 5 passed; `pnpm verify` green.

**Commit:** `git commit -m "feat(contracts): IR device and command schemas"`

---

### T9 — Domain: commands and client sessions
- [ ] done

**Files:** `packages/contracts/src/domain/command.ts`, `packages/contracts/src/domain/session.ts`,
`packages/contracts/src/index.ts`, `packages/contracts/test/command-session.test.ts`

**Context:** ARCHITECTURE §3.2 (command.ts, session.ts verbatim), §4.6; SPEC §6 Command, ClientSession.

**Do:**
1. Create `packages/contracts/src/domain/command.ts`:
   ```ts
   import { z } from "zod";
   import { ClientLabel, Level, Timestamp } from "../common.ts";
   import { AudioChannel } from "./audio.ts";
   import { HdmiInput } from "./display.ts";
   import { LightGang } from "./environment.ts";

   export const CommandBody = z.discriminatedUnion("kind", [
     z.object({ kind: z.literal("source.select"), input: HdmiInput }),
     z.object({ kind: z.literal("projector.power"), on: z.boolean() }),
     z.object({ kind: z.literal("projector.mains"), on: z.boolean() }), // technician, R11
     z.object({ kind: z.literal("screen.move"), to: z.enum(["raise", "lower"]) }),
     z.object({ kind: z.literal("audio.level"), channel: AudioChannel, level: Level, final: z.boolean() }),
     z.object({ kind: z.literal("audio.mute_all"), muted: z.boolean() }),
     z.object({ kind: z.literal("lights.set"), gang: LightGang, on: z.boolean() }),
     z.object({ kind: z.literal("ac.power"), on: z.boolean() }),
     z.object({ kind: z.literal("ac.step"), direction: z.enum(["down", "up"]) }),
   ]);
   export const CommandRequest = z.object({ client_cmd_id: z.uuid(), body: CommandBody });
   export const CommandStatus = z.enum(["pending", "sent", "confirmed", "assumed", "failed", "timed_out"]);
   export const Command = z.object({
     id: z.string(),
     client_cmd_id: z.uuid(),
     body: CommandBody,
     issued_by: z.object({ public_id: z.string(), label: ClientLabel }).nullable(), // null = schedule
     status: CommandStatus,
     error: z.string().nullable(),
     at: Timestamp,
   });

   export type CommandBody = z.infer<typeof CommandBody>;
   export type CommandRequest = z.infer<typeof CommandRequest>;
   export type CommandStatus = z.infer<typeof CommandStatus>;
   export type Command = z.infer<typeof Command>;
   ```
2. Create `packages/contracts/src/domain/session.ts`:
   ```ts
   import { z } from "zod";
   import { AccessLevel, ClientLabel, Timestamp } from "../common.ts";

   export const ClientType = z.enum(["kiosk", "remote"]);
   export const ClientSession = z.object({
     public_id: z.string(), // safe to broadcast; never the cookie id
     client_type: ClientType,
     label: ClientLabel,
     access: AccessLevel,
     unlocked_at: Timestamp.nullable(),
     last_activity: Timestamp.nullable(),
     expires_at: Timestamp.nullable(),
   });

   export type ClientType = z.infer<typeof ClientType>;
   export type ClientSession = z.infer<typeof ClientSession>;
   ```
3. Append to `index.ts`: `export * from "./domain/command.ts";` and `export * from "./domain/session.ts";`

**Test:** `packages/contracts/test/command-session.test.ts`
```ts
import { describe, expect, it } from "vitest";
import { Command, CommandBody, CommandRequest } from "../src/domain/command.ts";
import { ClientSession } from "../src/domain/session.ts";
import { AT } from "./helpers.ts";

const CMD_ID = "3b241101-e2bb-4255-8caf-4136c566a962";

describe("CommandBody", () => {
  it.each([
    { kind: "source.select", input: "smart_board" },
    { kind: "projector.power", on: true },
    { kind: "projector.mains", on: false },
    { kind: "screen.move", to: "raise" },
    { kind: "audio.level", channel: "mic", level: 62, final: true },
    { kind: "audio.mute_all", muted: true },
    { kind: "lights.set", gang: "rear", on: true },
    { kind: "ac.power", on: false },
    { kind: "ac.step", direction: "up" },
  ])("accepts $kind", (body) => {
    expect(CommandBody.safeParse(body).success).toBe(true);
  });
  it("rejects an unknown AC step direction", () => {
    expect(CommandBody.safeParse({ kind: "ac.step", direction: "left" }).success).toBe(false);
  });
  it("rejects audio.level without final", () => {
    expect(CommandBody.safeParse({ kind: "audio.level", channel: "pc", level: 38 }).success).toBe(false);
  });
});

describe("CommandRequest / Command", () => {
  it("rejects a client_cmd_id that is not a uuid", () => {
    expect(CommandRequest.safeParse({ client_cmd_id: "abc", body: { kind: "ac.power", on: true } }).success).toBe(false);
  });
  it("accepts a scheduled command (issued_by null)", () => {
    const command = { id: "c1", client_cmd_id: CMD_ID, body: { kind: "lights.set", gang: "front", on: false },
      issued_by: null, status: "confirmed", error: null, at: AT };
    expect(Command.safeParse(command).success).toBe(true);
  });
});

describe("ClientSession", () => {
  const session = { public_id: "p_7f3a", client_type: "remote", label: "phone", access: "control",
    unlocked_at: AT, last_activity: AT, expires_at: AT };
  it("accepts a remote control session", () => {
    expect(ClientSession.safeParse(session).success).toBe(true);
  });
  it("rejects an unknown access level", () => {
    expect(ClientSession.safeParse({ ...session, access: "admin" }).success).toBe(false);
  });
});
```

**Verify:** `pnpm --filter @eduscope/contracts test` → `command-session.test.ts` 15 passed; `pnpm verify` green.

**Commit:** `git commit -m "feat(contracts): command and session schemas"`

---

### T10 — Domain: schedule and system info
- [ ] done

**Files:** `packages/contracts/src/domain/schedule.ts`, `packages/contracts/src/domain/system.ts`,
`packages/contracts/src/index.ts`, `packages/contracts/test/schedule-system.test.ts`

**Context:** ARCHITECTURE §3.3 (schedule.ts, system.ts); SPEC S3b (Network rows), S3c (Schedule), S3e
(About). zod v4 throws if you call `.omit()` on an object that has a `.refine()`, so the class-block
fields are exported as a plain shape for `ClassBlockInput` (T12).
`NetworkInfo.controller` = whether core-api currently reaches hw-service (S3b "Controller: Online").

**Do:**
1. Create `packages/contracts/src/domain/schedule.ts`:
   ```ts
   import { z } from "zod";
   import { CommandBody } from "./command.ts";

   export const Weekday = z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
   /** Local wall-clock time "HH:MM", 24 h. */
   export const ClockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24 h)");

   /** Shared with ClassBlockInput (api/schedule.ts): zod v4 cannot .omit() a refined object. */
   export const classBlockShape = {
     days: z.array(Weekday).min(1),
     start: ClockTime,
     end: ClockTime,
   };
   export const startBeforeEnd = (block: { start: string; end: string }): boolean => block.start < block.end;

   export const ClassBlock = z
     .object({ id: z.string(), ...classBlockShape })
     .refine(startBeforeEnd, { message: "end must be after start", path: ["end"] });
   export const TimedAction = z.object({
     id: z.string(),
     name: z.string().trim().min(1).max(40),
     time: ClockTime,
     days: z.array(Weekday).min(1),
     enabled: z.boolean(),
     steps: z.array(CommandBody).min(1),
   });
   export const Schedule = z.object({ class_blocks: z.array(ClassBlock), actions: z.array(TimedAction) });

   export type Weekday = z.infer<typeof Weekday>;
   export type ClockTime = z.infer<typeof ClockTime>;
   export type ClassBlock = z.infer<typeof ClassBlock>;
   export type TimedAction = z.infer<typeof TimedAction>;
   export type Schedule = z.infer<typeof Schedule>;
   ```
2. Create `packages/contracts/src/domain/system.ts`:
   ```ts
   import { z } from "zod";
   import { AccessLevel, ClientLabel } from "../common.ts";
   import { ClientType } from "./session.ts";

   export const NetworkConnection = z.discriminatedUnion("kind", [
     z.object({ kind: z.literal("ethernet") }),
     z.object({ kind: z.literal("wifi"), ssid: z.string(), signal_pct: z.number().int().min(0).max(100).nullable() }),
     z.object({ kind: z.literal("none") }),
   ]);
   export const ConnectedClient = z.object({
     public_id: z.string().nullable(), // null = socket without a session (view)
     label: ClientLabel,
     client_type: ClientType,
     access: AccessLevel,
   });
   export const NetworkInfo = z.object({ // S3b
     hostname: z.string(),
     address: z.string().nullable(),
     connection: NetworkConnection,
     controller: z.object({ hw: z.enum(["up", "down"]) }),
     clients: z.array(ConnectedClient),
   });
   export const AboutInfo = z.object({ // S3e
     room: z.string(),
     version: z.string(),
     uptime_s: z.number().int().nonnegative(),
     pi_model: z.string().nullable(),
     url: z.url(),
   });

   export type NetworkConnection = z.infer<typeof NetworkConnection>;
   export type ConnectedClient = z.infer<typeof ConnectedClient>;
   export type NetworkInfo = z.infer<typeof NetworkInfo>;
   export type AboutInfo = z.infer<typeof AboutInfo>;
   ```
3. Append to `index.ts`: `export * from "./domain/schedule.ts";` and `export * from "./domain/system.ts";`

**Test:** `packages/contracts/test/schedule-system.test.ts`
```ts
import { describe, expect, it } from "vitest";
import { ClassBlock, ClockTime, Schedule, TimedAction } from "../src/domain/schedule.ts";
import { AboutInfo, NetworkInfo } from "../src/domain/system.ts";

describe("schedule", () => {
  const block = { id: "b1", days: ["mon", "wed"], start: "08:00", end: "09:30" };
  it("accepts a class block", () => {
    expect(ClassBlock.safeParse(block).success).toBe(true);
  });
  it("rejects a block that ends before it starts, on the end field", () => {
    const result = ClassBlock.safeParse({ ...block, start: "10:00", end: "09:00" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["end"]);
  });
  it("rejects malformed clock times", () => {
    expect(ClockTime.safeParse("24:00").success).toBe(false);
    expect(ClockTime.safeParse("8:00").success).toBe(false);
    expect(ClockTime.safeParse("18:00").success).toBe(true);
  });
  it("timed action needs at least one valid step", () => {
    const action = { id: "a1", name: "All off", time: "18:00", days: ["mon", "tue", "wed", "thu", "fri"],
      enabled: true, steps: [{ kind: "lights.set", gang: "front", on: false }] };
    expect(TimedAction.safeParse(action).success).toBe(true);
    expect(TimedAction.safeParse({ ...action, steps: [] }).success).toBe(false);
    expect(TimedAction.safeParse({ ...action, steps: [{ kind: "lights.dim" }] }).success).toBe(false);
  });
  it("accepts an empty schedule", () => {
    expect(Schedule.safeParse({ class_blocks: [], actions: [] }).success).toBe(true);
  });
});

describe("system", () => {
  it("accepts Wi-Fi network info with clients", () => {
    const info = { hostname: "r-101.local", address: "10.20.1.101",
      connection: { kind: "wifi", ssid: "CAMPUS", signal_pct: 72 }, controller: { hw: "up" },
      clients: [{ public_id: null, label: "room screen", client_type: "kiosk", access: "control" }] };
    expect(NetworkInfo.safeParse(info).success).toBe(true);
    expect(NetworkInfo.safeParse({ ...info, connection: { kind: "lte" } }).success).toBe(false);
  });
  it("about url must be a full URL", () => {
    const about = { room: "R-101", version: "0.1.0", uptime_s: 3600, pi_model: "Raspberry Pi 5", url: "http://r-101.local" };
    expect(AboutInfo.safeParse(about).success).toBe(true);
    expect(AboutInfo.safeParse({ ...about, url: "r-101.local" }).success).toBe(false);
  });
});
```

**Verify:** `pnpm --filter @eduscope/contracts test` → `schedule-system.test.ts` 7 passed; `pnpm verify` green.

**Commit:** `git commit -m "feat(contracts): schedule and system schemas"`

---

### T11 — RoomState and the `room-normal` fixture
- [ ] done

**Files:** `packages/contracts/src/state.ts`, `packages/contracts/src/index.ts`,
`packages/contracts/fixtures/state/room-normal.json`, `packages/contracts/test/helpers.ts` (modify),
`packages/contracts/test/state.test.ts`

**Context:** ARCHITECTURE §3.2 (state.ts verbatim). M01 note: `room-normal.json` reproduces the screenshot
values. Screen 01 (whole page): source Podium PC "Selected, confirmed"; projector "On · confirmed by draw"
`287 W`; screen "Lowered"; mic `62`, PC `38`, not muted; Front of room On, Rear Off; AC "On · assumed",
`24°`; sensors `26.4°`, `61%`, Detected, Closed, "3 reporting"; header "All systems normal", `R-101`.
Screen 02: Router LQI `214`/`231`; `231 V`, `1.84 kWh`, `13 A`; Room climate battery `98%`, link `168`,
`12s ago`; coordinator details; mesh `5` paired, `2` routers, `3` end devices, joining Closed. M02's mock
seeds from this file.

**Do:**
1. Create `packages/contracts/src/state.ts`:
   ```ts
   import { z } from "zod";
   import { observed, Timestamp } from "./common.ts";
   import { AudioState } from "./domain/audio.ts";
   import { Device } from "./domain/device.ts";
   import { HdmiInput, PowerReading, ProjectorFeedback, ProjectorState, ScreenPosition } from "./domain/display.ts";
   import { AcState, SensorReading } from "./domain/environment.ts";
   import { Interlock } from "./domain/interlock.ts";
   import { IrBlaster } from "./domain/ir.ts";
   import { Room } from "./domain/room.ts";
   import { Coordinator, Mesh, ZigbeeNode } from "./domain/zigbee.ts";

   /** The full snapshot pushed to every client. */
   export const RoomState = z.object({
     rev: z.number().int().nonnegative(), // monotonic; client drops older revs
     server_time: Timestamp,
     room: Room,
     connection: z.object({ hw: z.enum(["up", "down"]) }),
     display: z.object({
       source: observed(HdmiInput),
       projector: z.object({
         state: observed(ProjectorState),
         power: observed(PowerReading),
         feedback: ProjectorFeedback,
         mains: observed(z.boolean()),
       }),
       screen: observed(ScreenPosition),
     }),
     audio: AudioState,
     environment: z.object({
       lights: z.object({ front: observed(z.boolean()), rear: observed(z.boolean()) }),
       ac: AcState,
       sensors: z.object({
         temperature: SensorReading,
         humidity: SensorReading,
         occupancy: SensorReading,
         contact: SensorReading,
         reporting: z.object({ count: z.number().int(), of: z.number().int() }), // S1.E41
       }),
     }),
     zigbee: z.object({ coordinator: Coordinator, mesh: Mesh, nodes: z.array(ZigbeeNode) }),
     ir_blaster: IrBlaster,
     interlock: Interlock,
     devices: z.array(Device), // online state per device (H8)
   });

   export type RoomState = z.infer<typeof RoomState>;
   ```
2. Append to `index.ts`: `export * from "./state.ts";`
3. Append to `packages/contracts/test/helpers.ts` (add the import at the top of the file):
   ```ts
   import { readdirSync, readFileSync } from "node:fs";

   /** Parse a JSON file under packages/contracts/fixtures/ (path relative to that folder). */
   export function readFixture(relativePath: string): unknown {
     const text = readFileSync(new URL(`../fixtures/${relativePath}`, import.meta.url), "utf8");
     const parsed: unknown = JSON.parse(text);
     return parsed;
   }

   /** Sorted *.json file names in a fixtures sub-folder. */
   export function listFixtures(folder: string): string[] {
     return readdirSync(new URL(`../fixtures/${folder}/`, import.meta.url))
       .filter((name) => name.endsWith(".json"))
       .sort();
   }
   ```
4. Create `packages/contracts/fixtures/state/room-normal.json` with exactly this content:
   ```json
   {
     "rev": 1,
     "server_time": "2026-10-05T10:42:00Z",
     "room": {
       "id": "R-101",
       "hostname": "r-101.local",
       "status": { "level": "normal", "text": "All systems normal" }
     },
     "connection": { "hw": "up" },
     "display": {
       "source": { "value": "podium_pc", "confidence": "confirmed", "source": "hdmi_switch", "updated_at": "2026-10-05T08:55:20Z", "stale": false, "changed_by": "podium PC" },
       "projector": {
         "state": { "value": "running", "confidence": "confirmed", "source": "power_meter", "updated_at": "2026-10-05T08:56:40Z", "stale": false, "changed_by": "room screen" },
         "power": {
           "value": { "watts": 287, "volts": 231, "kwh_today": 1.84, "rating_a": 13, "at": "2026-10-05T10:41:30Z" },
           "confidence": "confirmed", "source": "power_meter", "updated_at": "2026-10-05T10:41:30Z", "stale": false, "changed_by": null
         },
         "feedback": { "last_ir": "power_on", "sent_at": "2026-10-05T08:55:12Z", "phase": "idle" },
         "mains": { "value": true, "confidence": "confirmed", "source": "power_meter", "updated_at": "2026-10-05T07:30:00Z", "stale": false, "changed_by": null }
       },
       "screen": { "value": "lowered", "confidence": "confirmed", "source": "switch", "updated_at": "2026-10-05T08:55:40Z", "stale": false, "changed_by": "room screen" }
     },
     "audio": {
       "channels": {
         "mic": { "value": 62, "confidence": "confirmed", "source": "mixer", "updated_at": "2026-10-05T09:01:05Z", "stale": false, "changed_by": "room screen" },
         "pc": { "value": 38, "confidence": "confirmed", "source": "mixer", "updated_at": "2026-10-05T09:01:12Z", "stale": false, "changed_by": "room screen" }
       },
       "muted_all": { "value": false, "confidence": "confirmed", "source": "mixer", "updated_at": "2026-10-05T07:30:00Z", "stale": false, "changed_by": null },
       "saved_levels": { "mic": null, "pc": null }
     },
     "environment": {
       "lights": {
         "front": { "value": true, "confidence": "confirmed", "source": "switch", "updated_at": "2026-10-05T08:50:02Z", "stale": false, "changed_by": "by hand" },
         "rear": { "value": false, "confidence": "confirmed", "source": "switch", "updated_at": "2026-10-05T08:50:02Z", "stale": false, "changed_by": null }
       },
       "ac": {
         "power": { "value": "on", "confidence": "assumed", "source": "ir", "updated_at": "2026-10-05T08:58:30Z", "stale": false, "changed_by": "room screen" },
         "setpoint_c": { "value": 24, "confidence": "assumed", "source": "ir", "updated_at": "2026-10-05T08:58:30Z", "stale": false, "changed_by": "room screen" },
         "available_setpoints": [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30]
       },
       "sensors": {
         "temperature": { "kind": "temperature", "value": 26.4, "node": "r101_temp", "at": "2026-10-05T10:41:48Z", "stale": false },
         "humidity": { "kind": "humidity", "value": 61, "node": "r101_temp", "at": "2026-10-05T10:41:48Z", "stale": false },
         "occupancy": { "kind": "occupancy", "value": "detected", "node": "r101_motion", "at": "2026-10-05T10:38:02Z", "stale": false },
         "contact": { "kind": "contact", "value": "closed", "node": "r101_door", "at": "2026-10-05T09:12:40Z", "stale": false },
         "reporting": { "count": 3, "of": 3 }
       }
     },
     "zigbee": {
       "coordinator": {
         "model": "ZG-808Z", "chipset": "CC2652P1", "firmware": "Z-Stack 3.x.0", "channel": 25,
         "tx_power_dbm": 20, "port": "zigbee-coord", "antenna": "SMA, external", "status": "online"
       },
       "mesh": { "paired": 5, "routers": 2, "end_devices": 3, "joining": { "state": "closed" } },
       "nodes": [
         { "ieee": "0xa4c1380f2b9e0001", "friendly_name": "r101_lights", "model": "ZBM5-2C-86W", "role": "router", "power_source": "mains", "lqi": 214, "battery_pct": null, "last_seen": "2026-10-05T10:41:55Z", "online": true },
         { "ieee": "0xa4c1380f2b9e0002", "friendly_name": "r101_proj_plug", "model": "S60ZBTPG", "role": "router", "power_source": "mains", "lqi": 231, "battery_pct": null, "last_seen": "2026-10-05T10:41:30Z", "online": true },
         { "ieee": "0x00124b0029b70003", "friendly_name": "r101_temp", "model": "SNZB-02P", "role": "end_device", "power_source": "battery", "lqi": 168, "battery_pct": 98, "last_seen": "2026-10-05T10:41:48Z", "online": true },
         { "ieee": "0x00124b0029b70004", "friendly_name": "r101_motion", "model": "SNZB-03P", "role": "end_device", "power_source": "battery", "lqi": 142, "battery_pct": 91, "last_seen": "2026-10-05T10:38:02Z", "online": true },
         { "ieee": "0x00124b0029b70005", "friendly_name": "r101_door", "model": "SNZB-04PR2", "role": "end_device", "power_source": "battery", "lqi": 155, "battery_pct": 87, "last_seen": "2026-10-05T10:33:10Z", "online": true }
       ]
     },
     "ir_blaster": {
       "id": "ZS06", "topic": "r101_ir", "lqi": 196, "coverage": "360°, 12 m", "power": "mains",
       "online": { "value": true, "confidence": "confirmed", "source": "ir", "updated_at": "2026-10-05T10:40:00Z", "stale": false, "changed_by": null }
     },
     "interlock": { "status": "armed", "rule_text": "Projector mains stays on until draw is below 5 W." },
     "devices": [
       { "id": "projector", "name": "Projector", "kind": "projector", "transport": "ir_zs06", "brand": "Epson", "model": null, "hw_ref": null,
         "online": { "value": true, "confidence": "confirmed", "source": "power_meter", "updated_at": "2026-10-05T10:41:30Z", "stale": false, "changed_by": null },
         "outputs": [{ "id": "projector.ir", "name": "Projector power", "kind": "momentary" }] },
       { "id": "hdmi_switch", "name": "HDMI switch", "kind": "hdmi_switch", "transport": "local", "brand": null, "model": null, "hw_ref": null,
         "online": { "value": true, "confidence": "confirmed", "source": "hdmi_switch", "updated_at": "2026-10-05T10:40:00Z", "stale": false, "changed_by": null },
         "outputs": [{ "id": "display.source", "name": "Source", "kind": "select" }] },
       { "id": "projection_screen", "name": "Projection screen", "kind": "projection_screen", "transport": "local", "brand": null, "model": null, "hw_ref": null,
         "online": { "value": true, "confidence": "confirmed", "source": "switch", "updated_at": "2026-10-05T10:40:00Z", "stale": false, "changed_by": null },
         "outputs": [{ "id": "screen", "name": "Projection screen", "kind": "position" }] },
       { "id": "lights", "name": "Lighting switch", "kind": "lights", "transport": "zigbee", "brand": null, "model": "ZBM5-2C-86W", "hw_ref": "r101_lights",
         "online": { "value": true, "confidence": "confirmed", "source": "switch", "updated_at": "2026-10-05T10:41:55Z", "stale": false, "changed_by": null },
         "outputs": [{ "id": "lights.front", "name": "Front of room", "kind": "switch" }, { "id": "lights.rear", "name": "Rear of room", "kind": "switch" }] },
       { "id": "ac", "name": "Air conditioning", "kind": "ac", "transport": "ir_zs06", "brand": "Panasonic", "model": null, "hw_ref": null,
         "online": { "value": true, "confidence": "assumed", "source": "ir", "updated_at": "2026-10-05T10:40:00Z", "stale": false, "changed_by": null },
         "outputs": [{ "id": "ac", "name": "Air conditioning", "kind": "momentary" }] },
       { "id": "audio", "name": "Audio mixer", "kind": "audio", "transport": "local", "brand": null, "model": null, "hw_ref": null,
         "online": { "value": true, "confidence": "confirmed", "source": "mixer", "updated_at": "2026-10-05T10:40:00Z", "stale": false, "changed_by": null },
         "outputs": [{ "id": "audio.mic", "name": "Lecturer microphone", "kind": "level" }, { "id": "audio.pc", "name": "PC audio", "kind": "level" }] },
       { "id": "projector_socket", "name": "Projector socket", "kind": "power_socket", "transport": "zigbee", "brand": null, "model": "S60ZBTPG", "hw_ref": "r101_proj_plug",
         "online": { "value": true, "confidence": "confirmed", "source": "power_meter", "updated_at": "2026-10-05T10:41:30Z", "stale": false, "changed_by": null },
         "outputs": [{ "id": "projector.mains", "name": "Mains to projector", "kind": "switch" }] },
       { "id": "room_climate", "name": "Room climate", "kind": "sensor", "transport": "zigbee", "brand": null, "model": "SNZB-02P", "hw_ref": "r101_temp",
         "online": { "value": true, "confidence": "confirmed", "source": "sensor", "updated_at": "2026-10-05T10:41:48Z", "stale": false, "changed_by": null },
         "outputs": [] },
       { "id": "motion", "name": "Motion", "kind": "sensor", "transport": "zigbee", "brand": null, "model": "SNZB-03P", "hw_ref": "r101_motion",
         "online": { "value": true, "confidence": "confirmed", "source": "sensor", "updated_at": "2026-10-05T10:38:02Z", "stale": false, "changed_by": null },
         "outputs": [] },
       { "id": "door", "name": "Door", "kind": "sensor", "transport": "zigbee", "brand": null, "model": "SNZB-04PR2", "hw_ref": "r101_door",
         "online": { "value": true, "confidence": "confirmed", "source": "sensor", "updated_at": "2026-10-05T10:33:10Z", "stale": false, "changed_by": null },
         "outputs": [] },
       { "id": "ir_blaster", "name": "ZS06", "kind": "ir_blaster", "transport": "zigbee", "brand": null, "model": "ZS06", "hw_ref": "r101_ir",
         "online": { "value": true, "confidence": "confirmed", "source": "ir", "updated_at": "2026-10-05T10:40:00Z", "stale": false, "changed_by": null },
         "outputs": [] },
       { "id": "coordinator", "name": "Coordinator", "kind": "coordinator", "transport": "local", "brand": null, "model": "ZG-808Z", "hw_ref": "zigbee-coord",
         "online": { "value": true, "confidence": "confirmed", "source": "none", "updated_at": "2026-10-05T10:40:00Z", "stale": false, "changed_by": null },
         "outputs": [] }
     ]
   }
   ```

**Test:** `packages/contracts/test/state.test.ts`
```ts
import { describe, expect, it } from "vitest";
import { RoomState } from "../src/state.ts";
import { readFixture } from "./helpers.ts";

describe("room-normal.json", () => {
  it("room-normal.json parses as RoomState", () => {
    const result = RoomState.safeParse(readFixture("state/room-normal.json"));
    expect(result.error?.issues ?? []).toEqual([]);
  });

  it("reproduces the screenshot 01/02 values", () => {
    const state = RoomState.parse(readFixture("state/room-normal.json"));
    const node = (name: string) => state.zigbee.nodes.find((n) => n.friendly_name === name);
    expect(state.room.status.text).toBe("All systems normal");
    expect(state.display.source.value).toBe("podium_pc");
    expect(state.display.projector.state.value).toBe("running");
    expect(state.display.projector.power.value).toMatchObject({ watts: 287, volts: 231, kwh_today: 1.84, rating_a: 13 });
    expect(state.display.screen.value).toBe("lowered");
    expect(state.audio.channels.mic.value).toBe(62);
    expect(state.audio.channels.pc.value).toBe(38);
    expect(state.environment.lights.front.value).toBe(true);
    expect(state.environment.lights.rear.value).toBe(false);
    expect(state.environment.ac.power).toMatchObject({ value: "on", confidence: "assumed" });
    expect(state.environment.ac.setpoint_c.value).toBe(24);
    expect(state.environment.sensors.temperature.value).toBe(26.4);
    expect(state.environment.sensors.humidity.value).toBe(61);
    expect(state.environment.sensors.occupancy.value).toBe("detected");
    expect(state.environment.sensors.contact.value).toBe("closed");
    expect(state.environment.sensors.reporting).toEqual({ count: 3, of: 3 });
    expect(node("r101_lights")?.lqi).toBe(214);
    expect(node("r101_proj_plug")?.lqi).toBe(231);
    expect(node("r101_temp")).toMatchObject({ battery_pct: 98, lqi: 168, last_seen: "2026-10-05T10:41:48Z" });
    expect(state.zigbee.mesh).toMatchObject({ paired: 5, routers: 2, end_devices: 3, joining: { state: "closed" } });
    expect(state.ir_blaster).toMatchObject({ id: "ZS06", lqi: 196, topic: "r101_ir" });
  });

  it("AC is never confirmed (R3)", () => {
    const state = RoomState.parse(readFixture("state/room-normal.json"));
    expect(state.environment.ac.power.confidence).not.toBe("confirmed");
    expect(state.environment.ac.setpoint_c.confidence).not.toBe("confirmed");
  });

  it("rejects a negative rev", () => {
    const state = RoomState.parse(readFixture("state/room-normal.json"));
    expect(RoomState.safeParse({ ...state, rev: -1 }).success).toBe(false);
  });
});
```

**Verify:** `pnpm --filter @eduscope/contracts test` → `state.test.ts` 4 passed, including
"room-normal.json parses as RoomState"; `pnpm verify` green.

**Commit:** `git commit -m "feat(contracts): RoomState and room-normal fixture"`

---

### T12 — REST API schemas
- [ ] done

**Files:** `packages/contracts/src/api/errors.ts`, `api/session.ts`, `api/state.ts`, `api/commands.ts`,
`api/ir.ts`, `api/schedule.ts`, `api/devices.ts`, `api/settings.ts`, `api/system.ts` (all under
`packages/contracts/src/`), `packages/contracts/src/index.ts`, `packages/contracts/test/api.test.ts`

**Context:** ARCHITECTURE §3.3 rows `api/*`; §5 (PIN lengths: room 4, technician 6; permit join 240 s);
SPEC S4, S3d, S3c. Response aliases (`GetStateResponse = RoomState`) give each route a distinct name so
`export *` never collides.

**Do:**
1. `api/errors.ts`:
   ```ts
   import { z } from "zod";

   export const ApiErrorCode = z.enum([
     "unauthorized", "forbidden", "validation", "precondition", "hw_unavailable", "not_found",
   ]);
   export const ApiError = z.object({ code: ApiErrorCode, message: z.string() });

   export type ApiErrorCode = z.infer<typeof ApiErrorCode>;
   export type ApiError = z.infer<typeof ApiError>;
   ```
2. `api/session.ts`:
   ```ts
   import { z } from "zod";
   import { ClientLabel } from "../common.ts";
   import { ClientSession } from "../domain/session.ts";

   /** GET /api/session */
   export const GetSessionResponse = ClientSession;
   /** POST /api/session/login — room PIN has 4 digits, technician PIN has 6. */
   export const LoginRequest = z
     .object({
       level: z.enum(["control", "technician"]),
       pin: z.string().regex(/^\d+$/, "PIN must be digits only"),
       label: ClientLabel,
     })
     .refine((req) => req.pin.length === (req.level === "control" ? 4 : 6), {
       message: "Room PIN has 4 digits, technician PIN has 6",
       path: ["pin"],
     });
   export const PinError = z.object({
     reason: z.enum(["wrong", "locked"]),
     retry_after_s: z.number().int().nonnegative().nullable(),
     attempts_left: z.number().int().nonnegative().nullable(),
   });
   export const LoginResult = z.union([ClientSession, PinError]);
   /** POST /api/session/lock */
   export const LockResponse = ClientSession;

   export type GetSessionResponse = z.infer<typeof GetSessionResponse>;
   export type LoginRequest = z.infer<typeof LoginRequest>;
   export type PinError = z.infer<typeof PinError>;
   export type LoginResult = z.infer<typeof LoginResult>;
   export type LockResponse = z.infer<typeof LockResponse>;
   ```
3. `api/state.ts`:
   ```ts
   import type { z } from "zod";
   import { RoomState } from "../state.ts";

   /** GET /api/state */
   export const GetStateResponse = RoomState;
   export type GetStateResponse = z.infer<typeof GetStateResponse>;
   ```
4. `api/commands.ts`:
   ```ts
   import type { z } from "zod";
   import { Command } from "../domain/command.ts";

   /** POST /api/commands (body: CommandRequest) → 202 */
   export const PostCommandResponse = Command;
   export type PostCommandResponse = z.infer<typeof PostCommandResponse>;
   ```
5. `api/ir.ts`:
   ```ts
   import { z } from "zod";
   import { IrCommandRole, IrDevice, IrDeviceKind, IrSetpoint, IrTransport } from "../domain/ir.ts";

   /** GET /api/ir/devices */
   export const IrDeviceList = z.array(IrDevice);
   /** POST /api/ir/devices (S3.E9 sheet) */
   export const IrDeviceCreate = z.object({
     name: z.string().trim().min(1).max(40),
     brand: z.string().trim().min(1).max(40),
     kind: IrDeviceKind,
     transport: IrTransport,
   });
   /** PATCH /api/ir/devices/:id */
   export const IrDeviceUpdate = IrDeviceCreate.partial();
   /** POST /api/ir/devices/:id/commands (S3.E16 sheet) — setpoint given exactly when role is setpoint. */
   export const IrCommandCreate = z
     .object({
       name: z.string().trim().min(1).max(40),
       role: IrCommandRole,
       setpoint: IrSetpoint.nullable(),
     })
     .refine((cmd) => (cmd.role === "setpoint") === (cmd.setpoint !== null), {
       message: "setpoint is required exactly when role is setpoint",
       path: ["setpoint"],
     });
   /** POST /api/ir/commands/:id/test-result (R5) */
   export const IrTestResultRequest = z.object({ reacted: z.boolean() });

   export type IrDeviceList = z.infer<typeof IrDeviceList>;
   export type IrDeviceCreate = z.infer<typeof IrDeviceCreate>;
   export type IrDeviceUpdate = z.infer<typeof IrDeviceUpdate>;
   export type IrCommandCreate = z.infer<typeof IrCommandCreate>;
   export type IrTestResultRequest = z.infer<typeof IrTestResultRequest>;
   ```
6. `api/schedule.ts`:
   ```ts
   import { z } from "zod";
   import { classBlockShape, Schedule, startBeforeEnd, TimedAction } from "../domain/schedule.ts";

   /** GET /api/schedule */
   export const GetScheduleResponse = Schedule;
   /** POST/PUT /api/schedule/blocks */
   export const ClassBlockInput = z
     .object(classBlockShape)
     .refine(startBeforeEnd, { message: "end must be after start", path: ["end"] });
   /** POST/PUT /api/schedule/actions */
   export const TimedActionInput = TimedAction.omit({ id: true });

   export type GetScheduleResponse = z.infer<typeof GetScheduleResponse>;
   export type ClassBlockInput = z.infer<typeof ClassBlockInput>;
   export type TimedActionInput = z.infer<typeof TimedActionInput>;
   ```
7. `api/devices.ts`:
   ```ts
   import { z } from "zod";
   import { Device } from "../domain/device.ts";

   /** GET /api/devices (PATCH body: DevicePatch) */
   export const DeviceList = z.array(Device);
   /** POST /api/zigbee/permit-join — always 4 minutes (S3d). */
   export const PermitJoinRequest = z.object({ seconds: z.literal(240) });

   export type DeviceList = z.infer<typeof DeviceList>;
   export type PermitJoinRequest = z.infer<typeof PermitJoinRequest>;
   ```
8. `api/settings.ts`:
   ```ts
   import { z } from "zod";

   /** PUT /api/settings/pins/room */
   export const RoomPinRequest = z.object({ pin: z.string().regex(/^\d{4}$/, "Room PIN is 4 digits") });
   /** PUT /api/settings/pins/technician */
   export const TechnicianPinRequest = z.object({ pin: z.string().regex(/^\d{6}$/, "Technician PIN is 6 digits") });

   export type RoomPinRequest = z.infer<typeof RoomPinRequest>;
   export type TechnicianPinRequest = z.infer<typeof TechnicianPinRequest>;
   ```
9. `api/system.ts`:
   ```ts
   import type { z } from "zod";
   import { AboutInfo, NetworkInfo } from "../domain/system.ts";

   /** GET /api/system/network */
   export const GetNetworkResponse = NetworkInfo;
   /** GET /api/system/about */
   export const GetAboutResponse = AboutInfo;

   export type GetNetworkResponse = z.infer<typeof GetNetworkResponse>;
   export type GetAboutResponse = z.infer<typeof GetAboutResponse>;
   ```
10. Append to `index.ts` (one line per file, this order): `./api/errors.ts`, `./api/session.ts`,
    `./api/state.ts`, `./api/commands.ts`, `./api/ir.ts`, `./api/schedule.ts`, `./api/devices.ts`,
    `./api/settings.ts`, `./api/system.ts` — each as `export * from "<path>";`.

**Test:** `packages/contracts/test/api.test.ts`
```ts
import { describe, expect, it } from "vitest";
import { ClassBlockInput, TimedActionInput } from "../src/api/schedule.ts";
import { ApiError } from "../src/api/errors.ts";
import { IrCommandCreate } from "../src/api/ir.ts";
import { PermitJoinRequest } from "../src/api/devices.ts";
import { LoginRequest, LoginResult } from "../src/api/session.ts";
import { RoomPinRequest, TechnicianPinRequest } from "../src/api/settings.ts";
import { AT } from "./helpers.ts";

describe("LoginRequest", () => {
  it("room PIN is 4 digits, technician PIN is 6", () => {
    expect(LoginRequest.safeParse({ level: "control", pin: "1234", label: "phone" }).success).toBe(true);
    expect(LoginRequest.safeParse({ level: "technician", pin: "123456", label: "laptop" }).success).toBe(true);
    expect(LoginRequest.safeParse({ level: "control", pin: "123456", label: "phone" }).success).toBe(false);
    expect(LoginRequest.safeParse({ level: "technician", pin: "1234", label: "phone" }).success).toBe(false);
  });
  it("rejects non-digit PINs and level view", () => {
    expect(LoginRequest.safeParse({ level: "control", pin: "12a4", label: "phone" }).success).toBe(false);
    expect(LoginRequest.safeParse({ level: "view", pin: "1234", label: "phone" }).success).toBe(false);
  });
});

describe("LoginResult", () => {
  it("accepts a session or a PIN error", () => {
    const session = { public_id: "p1", client_type: "remote", label: "phone", access: "control",
      unlocked_at: AT, last_activity: AT, expires_at: AT };
    expect(LoginResult.safeParse(session).success).toBe(true);
    expect(LoginResult.safeParse({ reason: "locked", retry_after_s: 58, attempts_left: 0 }).success).toBe(true);
    expect(LoginResult.safeParse({ reason: "nope", retry_after_s: null, attempts_left: null }).success).toBe(false);
  });
});

describe("IR, schedule, devices, settings, errors", () => {
  it("IrCommandCreate requires setpoint exactly for role setpoint", () => {
    const frame = { temp_c: 24, mode: "cool", fan: "auto" };
    expect(IrCommandCreate.safeParse({ name: "24°", role: "setpoint", setpoint: frame }).success).toBe(true);
    expect(IrCommandCreate.safeParse({ name: "24°", role: "setpoint", setpoint: null }).success).toBe(false);
    expect(IrCommandCreate.safeParse({ name: "Power on", role: "power_on", setpoint: frame }).success).toBe(false);
    expect(IrCommandCreate.safeParse({ name: "Power on", role: "power_on", setpoint: null }).success).toBe(true);
  });
  it("ClassBlockInput has no id and validates order", () => {
    expect(ClassBlockInput.safeParse({ days: ["fri"], start: "13:00", end: "14:30" }).success).toBe(true);
    expect(ClassBlockInput.safeParse({ days: ["fri"], start: "14:30", end: "13:00" }).success).toBe(false);
  });
  it("TimedActionInput has no id", () => {
    const action = { name: "All off", time: "18:00", days: ["mon"], enabled: true, steps: [{ kind: "ac.power", on: false }] };
    expect(TimedActionInput.safeParse(action).success).toBe(true);
  });
  it("permit join is always 240 s", () => {
    expect(PermitJoinRequest.safeParse({ seconds: 240 }).success).toBe(true);
    expect(PermitJoinRequest.safeParse({ seconds: 60 }).success).toBe(false);
  });
  it("PIN change lengths", () => {
    expect(RoomPinRequest.safeParse({ pin: "4321" }).success).toBe(true);
    expect(RoomPinRequest.safeParse({ pin: "54321" }).success).toBe(false);
    expect(TechnicianPinRequest.safeParse({ pin: "654321" }).success).toBe(true);
    expect(TechnicianPinRequest.safeParse({ pin: "4321" }).success).toBe(false);
  });
  it("ApiError rejects unknown codes", () => {
    expect(ApiError.safeParse({ code: "hw_unavailable", message: "Hardware service offline" }).success).toBe(true);
    expect(ApiError.safeParse({ code: "teapot", message: "" }).success).toBe(false);
  });
});
```

**Verify:** `pnpm --filter @eduscope/contracts test` → `api.test.ts` 9 passed; `pnpm verify` green.

**Commit:** `git commit -m "feat(contracts): REST API schemas"`

---

### T13 — WebSocket frames
- [ ] done

**Files:** `packages/contracts/src/ws.ts`, `packages/contracts/src/index.ts`, `packages/contracts/test/ws.test.ts`

**Context:** ARCHITECTURE §3.3 row `ws.ts`, §4.5 (event handling), §6.6. `invalidate.keys` holds query keys
such as `["ir","devices"]`.

**Do:**
1. Create `packages/contracts/src/ws.ts`:
   ```ts
   import { z } from "zod";
   import { ChangedBy, ClientLabel, Timestamp } from "./common.ts";
   import { Command } from "./domain/command.ts";
   import { IrCaptureStatus } from "./domain/ir.ts";
   import { ClientSession } from "./domain/session.ts";
   import { RoomState } from "./state.ts";

   /** Server → client. The WS is receive-only for commands (D-03). */
   export const ServerEvent = z.discriminatedUnion("type", [
     z.object({ type: z.literal("snapshot"), state: RoomState }),
     z.object({ type: z.literal("state"), state: RoomState }),
     z.object({ type: z.literal("command"), command: Command }),
     z.object({ type: z.literal("activity"), text: z.string(), by: ChangedBy, public_id: z.string().nullable() }),
     z.object({
       type: z.literal("ir_capture"),
       command_id: z.string(),
       status: IrCaptureStatus,
       deadline: Timestamp.nullable(),
     }),
     z.object({ type: z.literal("invalidate"), keys: z.array(z.array(z.string()).min(1)) }),
     z.object({ type: z.literal("session"), session: ClientSession }),
     z.object({ type: z.literal("ping") }),
   ]);

   /** Client → server. Anything else is dropped by core-api. */
   export const ClientMessage = z.discriminatedUnion("type", [
     z.object({ type: z.literal("hello"), label: ClientLabel }),
     z.object({ type: z.literal("pong") }),
   ]);

   export type ServerEvent = z.infer<typeof ServerEvent>;
   export type ClientMessage = z.infer<typeof ClientMessage>;
   ```
2. Append to `index.ts`: `export * from "./ws.ts";`

**Test:** `packages/contracts/test/ws.test.ts`
```ts
import { describe, expect, it } from "vitest";
import { ClientMessage, ServerEvent } from "../src/ws.ts";
import { AT, readFixture } from "./helpers.ts";

describe("ServerEvent", () => {
  it("accepts a snapshot of room-normal", () => {
    const result = ServerEvent.safeParse({ type: "snapshot", state: readFixture("state/room-normal.json") });
    expect(result.error?.issues ?? []).toEqual([]);
  });
  it("accepts activity, ir_capture, invalidate and ping", () => {
    expect(ServerEvent.safeParse({ type: "activity", text: "Rear of room turned on · from phone", by: "phone", public_id: "p1" }).success).toBe(true);
    expect(ServerEvent.safeParse({ type: "ir_capture", command_id: "cmd_ac_24", status: "listening", deadline: AT }).success).toBe(true);
    expect(ServerEvent.safeParse({ type: "invalidate", keys: [["ir", "devices"]] }).success).toBe(true);
    expect(ServerEvent.safeParse({ type: "ping" }).success).toBe(true);
  });
  it("rejects an unknown event type and an empty query key", () => {
    expect(ServerEvent.safeParse({ type: "patch", ops: [] }).success).toBe(false);
    expect(ServerEvent.safeParse({ type: "invalidate", keys: [[]] }).success).toBe(false);
  });
});

describe("ClientMessage", () => {
  it("accepts hello with a label and pong", () => {
    expect(ClientMessage.safeParse({ type: "hello", label: "tablet" }).success).toBe(true);
    expect(ClientMessage.safeParse({ type: "pong" }).success).toBe(true);
  });
  it("rejects commands over WS (D-03)", () => {
    expect(ClientMessage.safeParse({ type: "command", body: { kind: "ac.power", on: true } }).success).toBe(false);
  });
});
```

**Verify:** `pnpm --filter @eduscope/contracts test` → `ws.test.ts` 5 passed; `pnpm verify` green.

**Commit:** `git commit -m "feat(contracts): WebSocket frame schemas"`

---

### T14 — hw contract schemas (core-api ↔ hw-service)
- [ ] done

**Files:** `packages/contracts/src/hw/common.ts`, `hw/commands.ts`, `hw/data.ts`, `hw/snapshot.ts`,
`hw/events.ts`, `hw/index.ts` (under `packages/contracts/src/`), `packages/contracts/src/index.ts`,
`packages/contracts/test/hw-schemas.test.ts`

**Context:** ARCHITECTURE §3.4 (endpoints, `HwAck`, event table, "nullable when unknown"), §7.2. hw reports
raw facts only (no confidence, staleness or attribution). Every hw object is `z.strictObject` to mirror
pydantic `extra="forbid"` (M07). **Rule:** `src/hw/index.ts` must export **only zod schemas** (no helper
functions, no constants); T15/T16 rely on it.

**Do:**
1. `hw/common.ts`:
   ```ts
   import { z } from "zod";

   export const HwModule = z.enum([
     "lights", "projector_power", "ir", "hdmi", "projection_screen", "audio", "sensors", "zigbee_status",
   ]);
   export const HwDriverKind = z.enum(["fake", "real"]);
   export const HwErrorCode = z.enum(["device_offline", "timeout", "transport", "invalid"]);
   export const HwError = z.strictObject({ code: HwErrorCode, message: z.string() });
   /** "Accepted by the transport", not "state changed". State changes arrive only as events. */
   export const HwAck = z.discriminatedUnion("ok", [
     z.strictObject({ ok: z.literal(true) }),
     z.strictObject({ ok: z.literal(false), error: HwError }),
   ]);
   /** GET /v1/health */
   export const HwHealth = z.strictObject({
     ok: z.boolean(),
     mode: HwDriverKind,
     modules: z.strictObject({
       lights: HwDriverKind,
       projector_power: HwDriverKind,
       ir: HwDriverKind,
       hdmi: HwDriverKind,
       projection_screen: HwDriverKind,
       audio: HwDriverKind,
       sensors: HwDriverKind,
       zigbee_status: HwDriverKind,
     }),
   });

   export type HwModule = z.infer<typeof HwModule>;
   export type HwDriverKind = z.infer<typeof HwDriverKind>;
   export type HwErrorCode = z.infer<typeof HwErrorCode>;
   export type HwError = z.infer<typeof HwError>;
   export type HwAck = z.infer<typeof HwAck>;
   export type HwHealth = z.infer<typeof HwHealth>;
   ```
2. `hw/commands.ts` (request bodies; name rule `Hw<Module><Action>Request` for `POST /v1/<module>/<action>`):
   ```ts
   import { z } from "zod";
   import { Level } from "../common.ts";
   import { AudioChannel } from "../domain/audio.ts";
   import { HdmiInput } from "../domain/display.ts";
   import { LightGang } from "../domain/environment.ts";
   import { IrTransport } from "../domain/ir.ts";

   export const HwLightsSetRequest = z.strictObject({ gang: LightGang, on: z.boolean() });
   export const HwProjectorPowerRelayRequest = z.strictObject({ on: z.boolean() });
   export const HwIrSendRequest = z.strictObject({
     transport: IrTransport,
     code_format: z.literal("tuya"),
     code: z.string().min(1),
   });
   /** Blocks up to timeout_s. POST /v1/ir/learn/cancel has no body. */
   export const HwIrLearnRequest = z.strictObject({ transport: IrTransport, timeout_s: z.number().int().min(1).max(60) });
   export const HwIrLearnResult = z.discriminatedUnion("status", [
     z.strictObject({ status: z.literal("captured"), code_format: z.literal("tuya"), code: z.string().min(1) }),
     z.strictObject({ status: z.literal("timeout") }),
     z.strictObject({ status: z.literal("cancelled") }),
   ]);
   export const HwHdmiSelectRequest = z.strictObject({ input: HdmiInput });
   export const HwProjectionScreenMoveRequest = z.strictObject({ to: z.enum(["raise", "lower"]) });
   export const HwAudioLevelRequest = z.strictObject({ channel: AudioChannel, level: Level });
   export const HwAudioMuteRequest = z.strictObject({ channel: AudioChannel, muted: z.boolean() });
   export const HwZigbeeStatusPermitJoinRequest = z.strictObject({ seconds: z.number().int().min(0).max(254) });

   export type HwLightsSetRequest = z.infer<typeof HwLightsSetRequest>;
   export type HwProjectorPowerRelayRequest = z.infer<typeof HwProjectorPowerRelayRequest>;
   export type HwIrSendRequest = z.infer<typeof HwIrSendRequest>;
   export type HwIrLearnRequest = z.infer<typeof HwIrLearnRequest>;
   export type HwIrLearnResult = z.infer<typeof HwIrLearnResult>;
   export type HwHdmiSelectRequest = z.infer<typeof HwHdmiSelectRequest>;
   export type HwProjectionScreenMoveRequest = z.infer<typeof HwProjectionScreenMoveRequest>;
   export type HwAudioLevelRequest = z.infer<typeof HwAudioLevelRequest>;
   export type HwAudioMuteRequest = z.infer<typeof HwAudioMuteRequest>;
   export type HwZigbeeStatusPermitJoinRequest = z.infer<typeof HwZigbeeStatusPermitJoinRequest>;
   ```
3. `hw/data.ts` (event payloads):
   ```ts
   import { z } from "zod";
   import { Level, Timestamp } from "../common.ts";
   import { AudioChannel } from "../domain/audio.ts";
   import { HdmiInput } from "../domain/display.ts";
   import { LightGang } from "../domain/environment.ts";
   import { HwErrorCode, HwModule } from "./common.ts";

   export const HwScreenPosition = z.enum(["raised", "lowered", "moving", "unknown"]);
   export const HwLightsStateData = z.strictObject({ gang: LightGang, on: z.boolean() });
   export const HwRelayStateData = z.strictObject({ on: z.boolean() });
   export const HwPowerReadingData = z.strictObject({
     watts: z.number().nonnegative(),
     volts: z.number().nonnegative(),
     energy_kwh_total: z.number().nonnegative(), // core-api derives kwh_today
   });
   export const HwHdmiStateData = z.strictObject({ input: HdmiInput });
   export const HwScreenStateData = z.strictObject({ position: HwScreenPosition });
   export const HwAudioStateData = z.strictObject({ channel: AudioChannel, level: Level, muted: z.boolean() });
   export const HwSensorReadingData = z.discriminatedUnion("kind", [
     z.strictObject({ node: z.string(), kind: z.literal("temperature"), value: z.number() }),
     z.strictObject({ node: z.string(), kind: z.literal("humidity"), value: z.number().int().min(0).max(100) }),
     z.strictObject({ node: z.string(), kind: z.literal("occupancy"), value: z.enum(["detected", "clear"]) }),
     z.strictObject({ node: z.string(), kind: z.literal("contact"), value: z.enum(["open", "closed"]) }),
   ]);
   export const HwZigbeeNode = z.strictObject({
     ieee: z.string(),
     friendly_name: z.string(),
     model: z.string(),
     role: z.enum(["router", "end_device"]),
     power_source: z.enum(["mains", "battery"]),
     lqi: z.number().int().min(0).max(255).nullable(),
     battery_pct: z.number().int().min(0).max(100).nullable(),
     last_seen: Timestamp.nullable(),
     online: z.boolean(),
   });
   export const HwCoordinator = z.strictObject({
     model: z.string(),
     chipset: z.string(),
     firmware: z.string(),
     channel: z.number().int().min(11).max(26),
     tx_power_dbm: z.number(),
     port: z.string(),
     antenna: z.string(),
     status: z.enum(["online", "offline", "starting"]),
   });
   /** Counts are derived by core-api from the node list. */
   export const HwMeshData = z.strictObject({ joining_until: Timestamp.nullable() });
   export const HwIrBlasterData = z.strictObject({ online: z.boolean(), lqi: z.number().int().min(0).max(255).nullable() });
   export const HwIrLearnStateData = z.strictObject({ status: z.enum(["listening", "captured", "timeout", "cancelled"]) });
   export const HwErrorData = z.strictObject({ module: HwModule, code: HwErrorCode, message: z.string() });
   export const HwHeartbeatData = z.strictObject({});

   export type HwScreenPosition = z.infer<typeof HwScreenPosition>;
   export type HwLightsStateData = z.infer<typeof HwLightsStateData>;
   export type HwRelayStateData = z.infer<typeof HwRelayStateData>;
   export type HwPowerReadingData = z.infer<typeof HwPowerReadingData>;
   export type HwHdmiStateData = z.infer<typeof HwHdmiStateData>;
   export type HwScreenStateData = z.infer<typeof HwScreenStateData>;
   export type HwAudioStateData = z.infer<typeof HwAudioStateData>;
   export type HwSensorReadingData = z.infer<typeof HwSensorReadingData>;
   export type HwZigbeeNode = z.infer<typeof HwZigbeeNode>;
   export type HwCoordinator = z.infer<typeof HwCoordinator>;
   export type HwMeshData = z.infer<typeof HwMeshData>;
   export type HwIrBlasterData = z.infer<typeof HwIrBlasterData>;
   export type HwIrLearnStateData = z.infer<typeof HwIrLearnStateData>;
   export type HwErrorData = z.infer<typeof HwErrorData>;
   export type HwHeartbeatData = z.infer<typeof HwHeartbeatData>;
   ```
4. `hw/snapshot.ts`:
   ```ts
   import { z } from "zod";
   import { Level, Timestamp } from "../common.ts";
   import { HdmiInput } from "../domain/display.ts";
   import {
     HwCoordinator, HwIrBlasterData, HwScreenPosition, HwSensorReadingData, HwZigbeeNode,
   } from "./data.ts";

   export const HwPowerSample = z.strictObject({
     at: Timestamp,
     watts: z.number().nonnegative(),
     volts: z.number().nonnegative(),
     energy_kwh_total: z.number().nonnegative(),
   });
   export const HwSensorSample = z.strictObject({ at: Timestamp, reading: HwSensorReadingData });
   export const HwAudioChannelState = z.strictObject({ level: Level, muted: z.boolean() });
   /** GET /v1/snapshot and the first SSE event. null = not known yet. */
   export const HwSnapshot = z.strictObject({
     lights: z.strictObject({ front: z.boolean().nullable(), rear: z.boolean().nullable() }),
     projector_power: z.strictObject({ relay: z.boolean().nullable(), reading: HwPowerSample.nullable() }),
     hdmi: z.strictObject({ input: HdmiInput.nullable() }),
     projection_screen: z.strictObject({ position: HwScreenPosition }),
     audio: z.strictObject({ mic: HwAudioChannelState.nullable(), pc: HwAudioChannelState.nullable() }),
     sensors: z.array(HwSensorSample), // latest reading per (node, kind)
     zigbee: z.strictObject({
       coordinator: HwCoordinator.nullable(),
       nodes: z.array(HwZigbeeNode),
       joining_until: Timestamp.nullable(),
     }),
     ir: z.strictObject({ blaster: HwIrBlasterData.nullable() }),
   });

   export type HwPowerSample = z.infer<typeof HwPowerSample>;
   export type HwSensorSample = z.infer<typeof HwSensorSample>;
   export type HwAudioChannelState = z.infer<typeof HwAudioChannelState>;
   export type HwSnapshot = z.infer<typeof HwSnapshot>;
   ```
5. `hw/events.ts`:
   ```ts
   import { z } from "zod";
   import { Timestamp } from "../common.ts";
   import {
     HwAudioStateData, HwCoordinator, HwErrorData, HwHdmiStateData, HwHeartbeatData, HwIrBlasterData,
     HwIrLearnStateData, HwLightsStateData, HwMeshData, HwPowerReadingData, HwRelayStateData,
     HwScreenStateData, HwSensorReadingData, HwZigbeeNode,
   } from "./data.ts";
   import { HwSnapshot } from "./snapshot.ts";

   // Not exported: hw/index.ts must export zod schemas only.
   const event = <T extends string, D extends z.ZodType>(type: T, data: D) =>
     z.strictObject({ type: z.literal(type), at: Timestamp, data });

   /** One SSE event from GET /v1/events. SSE `event:` equals `type`. */
   export const HwEvent = z.discriminatedUnion("type", [
     event("snapshot", HwSnapshot),
     event("lights.state", HwLightsStateData),
     event("projector_power.relay", HwRelayStateData),
     event("projector_power.reading", HwPowerReadingData),
     event("hdmi.state", HwHdmiStateData),
     event("projection_screen.state", HwScreenStateData),
     event("audio.state", HwAudioStateData),
     event("sensors.reading", HwSensorReadingData),
     event("zigbee.node", HwZigbeeNode),
     event("zigbee.coordinator", HwCoordinator),
     event("zigbee.mesh", HwMeshData),
     event("ir.blaster", HwIrBlasterData),
     event("ir.learn", HwIrLearnStateData),
     event("hw.error", HwErrorData),
     event("heartbeat", HwHeartbeatData),
   ]);

   export type HwEvent = z.infer<typeof HwEvent>;
   ```
6. `hw/index.ts`:
   ```ts
   export * from "./common.ts";
   export * from "./commands.ts";
   export * from "./data.ts";
   export * from "./snapshot.ts";
   export * from "./events.ts";
   ```
7. Append to `packages/contracts/src/index.ts`: `export * from "./hw/index.ts";`

**Test:** `packages/contracts/test/hw-schemas.test.ts`
```ts
import { describe, expect, it } from "vitest";
import type { z } from "zod";
import * as hw from "../src/hw/index.ts";
import { AT } from "./helpers.ts";

describe("hw contract", () => {
  it("exports only zod schemas from hw/index.ts", () => {
    const schemas: Record<string, z.ZodType> = { ...hw }; // compile-time check
    expect(Object.keys(schemas).length).toBeGreaterThan(30);
  });
  it("HwLightsSetRequest rejects an unknown gang and extra fields (extra=forbid)", () => {
    expect(hw.HwLightsSetRequest.safeParse({ gang: "rear", on: true }).success).toBe(true);
    expect(hw.HwLightsSetRequest.safeParse({ gang: "middle", on: true }).success).toBe(false);
    expect(hw.HwLightsSetRequest.safeParse({ gang: "rear", on: true, by: "phone" }).success).toBe(false);
  });
  it("HwAck is ok or a typed error", () => {
    expect(hw.HwAck.safeParse({ ok: true }).success).toBe(true);
    expect(hw.HwAck.safeParse({ ok: false, error: { code: "transport", message: "hardware intake pending" } }).success).toBe(true);
    expect(hw.HwAck.safeParse({ ok: false }).success).toBe(false);
  });
  it("HwEvent wraps data with type and at", () => {
    expect(hw.HwEvent.safeParse({ type: "lights.state", at: AT, data: { gang: "front", on: true } }).success).toBe(true);
    expect(hw.HwEvent.safeParse({ type: "lights.state", at: AT, data: { on: true } }).success).toBe(false);
    expect(hw.HwEvent.safeParse({ type: "heartbeat", at: AT, data: { extra: 1 } }).success).toBe(false);
  });
  it("hw facts carry no confidence (raw facts only)", () => {
    expect(hw.HwRelayStateData.safeParse({ on: true, confidence: "confirmed" }).success).toBe(false);
  });
});
```

**Verify:** `pnpm --filter @eduscope/contracts test` → `hw-schemas.test.ts` 5 passed; `pnpm verify` green.
If `pnpm typecheck` reports the `Record<string, z.ZodType>` line, a non-schema value is exported from
`hw/` — fix the export, do not change the test.

**Commit:** `git commit -m "feat(contracts): hw-service contract schemas"`

---

### T15 — hw golden fixtures and the naming rule
- [ ] done

**Files:** `packages/contracts/fixtures/README.md`, `packages/contracts/fixtures/hw/*.json` (31 files),
`packages/contracts/test/hw-fixture-name.ts`, `packages/contracts/test/hw-fixture-name.test.ts`,
`packages/contracts/test/hw-fixtures.test.ts`

**Context:** ARCHITECTURE §3.4 "Keeping pydantic in sync" steps 3–4. M01 note: file names map 1:1 to schema
names; M07's `test_contract_fixtures.py` implements the same rule in Python. M01 AC4: "every file in
`fixtures/hw/` parses with its schema". Values match `room-normal.json` (the fake hw in M07 can start from
them).

**Do:**
1. Create `packages/contracts/fixtures/README.md`:
   ````md
   # Contract fixtures

   Golden JSON examples. Vitest parses every file with zod (`packages/contracts/test/`); M07's
   `services/hw/tests/test_contract_fixtures.py` parses every `hw/` file with pydantic, re-serialises it
   with `model_dump(mode="json")` and compares. A change to a hw schema updates zod, pydantic and these
   files **in one commit**.

   - `state/room-normal.json` — a `RoomState` reproducing screenshots 01 and 02. The kiosk mock seeds from it.
   - `hw/` — one file per hw request, response and event type.

   ## hw file-name → schema rule

   Strip `.json`, split on `.`. `Pascal(x)` = split `x` on `_`, capitalise each part, join.

   | Pattern | Schema | Extra check |
   |---|---|---|
   | `event.<type>.json` (`<type>` may contain dots) | `HwEvent` | parsed `type` equals `<type>` |
   | `request.<module>.<action>.json` | `Hw` + Pascal(module) + Pascal(action) + `Request` | — |
   | `response.<name>.json` or `response.<name>.<variant>.json` | `Hw` + Pascal(name) | `<variant>` is a label only |

   Examples: `event.lights.state.json` → `HwEvent` with `type: "lights.state"`;
   `request.zigbee_status.permit_join.json` → `HwZigbeeStatusPermitJoinRequest`;
   `response.ack.error.json` → `HwAck`; `response.ir_learn_result.timeout.json` → `HwIrLearnResult`.

   Pydantic model class names equal the zod schema names. Timestamps use the `Z` suffix so pydantic
   round-trips them unchanged. Every `HwEvent` type and every `Hw*Request` schema must have a fixture
   (enforced by `test/hw-fixtures.test.ts`).
   ````
2. Create `packages/contracts/test/hw-fixture-name.ts`:
   ```ts
   export type HwFixtureTarget =
     | { kind: "event"; schema: "HwEvent"; eventType: string }
     | { kind: "request" | "response"; schema: string };

   const pascal = (snake: string): string =>
     snake
       .split("_")
       .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
       .join("");

   /** fixtures/README.md "hw file-name → schema rule". */
   export function hwFixtureTarget(fileName: string): HwFixtureTarget {
     if (!fileName.endsWith(".json")) {
       throw new Error(`Not a JSON fixture: ${fileName}`);
     }
     const [kind, ...rest] = fileName.slice(0, -".json".length).split(".");
     const [first, second] = rest;
     if (kind === "event" && first !== undefined) {
       return { kind: "event", schema: "HwEvent", eventType: rest.join(".") };
     }
     if (kind === "request" && first !== undefined && second !== undefined && rest.length === 2) {
       return { kind: "request", schema: `Hw${pascal(first)}${pascal(second)}Request` };
     }
     if (kind === "response" && first !== undefined && rest.length <= 2) {
       return { kind: "response", schema: `Hw${pascal(first)}` };
     }
     throw new Error(`Unrecognised hw fixture name: ${fileName}`);
   }
   ```
3. Create the 31 fixture files below in `packages/contracts/fixtures/hw/`. Format every file as 2-space
   indented JSON with a trailing newline.

   **Requests**
   | File | Content |
   |---|---|
   | `request.lights.set.json` | `{"gang": "rear", "on": true}` |
   | `request.projector_power.relay.json` | `{"on": true}` |
   | `request.ir.send.json` | `{"transport": "ir_zs06", "code_format": "tuya", "code": "C/8hRgHrBkYBgAMH"}` |
   | `request.ir.learn.json` | `{"transport": "ir_zs06", "timeout_s": 20}` |
   | `request.hdmi.select.json` | `{"input": "smart_board"}` |
   | `request.projection_screen.move.json` | `{"to": "raise"}` |
   | `request.audio.level.json` | `{"channel": "mic", "level": 62}` |
   | `request.audio.mute.json` | `{"channel": "pc", "muted": true}` |
   | `request.zigbee_status.permit_join.json` | `{"seconds": 240}` |

   **Responses**
   | File | Content |
   |---|---|
   | `response.ack.ok.json` | `{"ok": true}` |
   | `response.ack.error.json` | `{"ok": false, "error": {"code": "device_offline", "message": "r101_lights is offline"}}` |
   | `response.health.json` | `{"ok": true, "mode": "fake", "modules": {"lights": "fake", "projector_power": "fake", "ir": "fake", "hdmi": "fake", "projection_screen": "fake", "audio": "fake", "sensors": "fake", "zigbee_status": "fake"}}` |
   | `response.ir_learn_result.captured.json` | `{"status": "captured", "code_format": "tuya", "code": "C/8hRgHrBkYBgAMH"}` |
   | `response.ir_learn_result.timeout.json` | `{"status": "timeout"}` |
   | `response.ir_learn_result.cancelled.json` | `{"status": "cancelled"}` |
   | `response.snapshot.json` | the snapshot object below |

   `response.snapshot.json`:
   ```json
   {
     "lights": { "front": true, "rear": false },
     "projector_power": {
       "relay": true,
       "reading": { "at": "2026-10-05T10:41:30Z", "watts": 287, "volts": 231, "energy_kwh_total": 412.67 }
     },
     "hdmi": { "input": "podium_pc" },
     "projection_screen": { "position": "lowered" },
     "audio": { "mic": { "level": 62, "muted": false }, "pc": { "level": 38, "muted": false } },
     "sensors": [
       { "at": "2026-10-05T10:41:48Z", "reading": { "node": "r101_temp", "kind": "temperature", "value": 26.4 } },
       { "at": "2026-10-05T10:41:48Z", "reading": { "node": "r101_temp", "kind": "humidity", "value": 61 } },
       { "at": "2026-10-05T10:38:02Z", "reading": { "node": "r101_motion", "kind": "occupancy", "value": "detected" } },
       { "at": "2026-10-05T09:12:40Z", "reading": { "node": "r101_door", "kind": "contact", "value": "closed" } }
     ],
     "zigbee": {
       "coordinator": {
         "model": "ZG-808Z", "chipset": "CC2652P1", "firmware": "Z-Stack 3.x.0", "channel": 25,
         "tx_power_dbm": 20, "port": "zigbee-coord", "antenna": "SMA, external", "status": "online"
       },
       "nodes": [
         { "ieee": "0xa4c1380f2b9e0001", "friendly_name": "r101_lights", "model": "ZBM5-2C-86W", "role": "router", "power_source": "mains", "lqi": 214, "battery_pct": null, "last_seen": "2026-10-05T10:41:55Z", "online": true },
         { "ieee": "0xa4c1380f2b9e0002", "friendly_name": "r101_proj_plug", "model": "S60ZBTPG", "role": "router", "power_source": "mains", "lqi": 231, "battery_pct": null, "last_seen": "2026-10-05T10:41:30Z", "online": true },
         { "ieee": "0x00124b0029b70003", "friendly_name": "r101_temp", "model": "SNZB-02P", "role": "end_device", "power_source": "battery", "lqi": 168, "battery_pct": 98, "last_seen": "2026-10-05T10:41:48Z", "online": true },
         { "ieee": "0x00124b0029b70004", "friendly_name": "r101_motion", "model": "SNZB-03P", "role": "end_device", "power_source": "battery", "lqi": 142, "battery_pct": 91, "last_seen": "2026-10-05T10:38:02Z", "online": true },
         { "ieee": "0x00124b0029b70005", "friendly_name": "r101_door", "model": "SNZB-04PR2", "role": "end_device", "power_source": "battery", "lqi": 155, "battery_pct": 87, "last_seen": "2026-10-05T10:33:10Z", "online": true }
       ],
       "joining_until": null
     },
     "ir": { "blaster": { "online": true, "lqi": 196 } }
   }
   ```

   **Events** (every file is `{"type": <type>, "at": <at>, "data": <data>}`)
   | File | `at` | `data` |
   |---|---|---|
   | `event.snapshot.json` | `2026-10-05T10:42:00Z` | the full object from `response.snapshot.json`, unchanged |
   | `event.lights.state.json` | `2026-10-05T10:42:03Z` | `{"gang": "rear", "on": true}` |
   | `event.projector_power.relay.json` | `2026-10-05T10:42:04Z` | `{"on": true}` |
   | `event.projector_power.reading.json` | `2026-10-05T10:42:30Z` | `{"watts": 287, "volts": 231, "energy_kwh_total": 412.68}` |
   | `event.hdmi.state.json` | `2026-10-05T10:42:05Z` | `{"input": "smart_board"}` |
   | `event.projection_screen.state.json` | `2026-10-05T10:42:06Z` | `{"position": "moving"}` |
   | `event.audio.state.json` | `2026-10-05T10:42:07Z` | `{"channel": "mic", "level": 62, "muted": false}` |
   | `event.sensors.reading.json` | `2026-10-05T10:42:08Z` | `{"node": "r101_temp", "kind": "temperature", "value": 26.4}` |
   | `event.zigbee.node.json` | `2026-10-05T10:42:09Z` | the `r101_door` node object from the snapshot, with `"online": false` |
   | `event.zigbee.coordinator.json` | `2026-10-05T10:42:10Z` | the coordinator object from the snapshot, with `"status": "starting"` |
   | `event.zigbee.mesh.json` | `2026-10-05T10:42:11Z` | `{"joining_until": "2026-10-05T10:46:11Z"}` |
   | `event.ir.blaster.json` | `2026-10-05T10:42:12Z` | `{"online": true, "lqi": 196}` |
   | `event.ir.learn.json` | `2026-10-05T10:42:13Z` | `{"status": "listening"}` |
   | `event.hw.error.json` | `2026-10-05T10:42:14Z` | `{"module": "lights", "code": "timeout", "message": "No reply from r101_lights within 5 s"}` |
   | `event.heartbeat.json` | `2026-10-05T10:42:15Z` | `{}` |

**Test:** `packages/contracts/test/hw-fixture-name.test.ts`
```ts
import { describe, expect, it } from "vitest";
import { hwFixtureTarget } from "./hw-fixture-name.ts";

describe("hwFixtureTarget", () => {
  it("maps events to HwEvent with the dotted type", () => {
    expect(hwFixtureTarget("event.lights.state.json")).toEqual({ kind: "event", schema: "HwEvent", eventType: "lights.state" });
    expect(hwFixtureTarget("event.heartbeat.json")).toEqual({ kind: "event", schema: "HwEvent", eventType: "heartbeat" });
  });
  it("maps requests to Hw<Module><Action>Request", () => {
    expect(hwFixtureTarget("request.zigbee_status.permit_join.json").schema).toBe("HwZigbeeStatusPermitJoinRequest");
    expect(hwFixtureTarget("request.ir.send.json").schema).toBe("HwIrSendRequest");
  });
  it("maps responses to Hw<Name>, ignoring the variant", () => {
    expect(hwFixtureTarget("response.ack.error.json").schema).toBe("HwAck");
    expect(hwFixtureTarget("response.ir_learn_result.captured.json").schema).toBe("HwIrLearnResult");
    expect(hwFixtureTarget("response.health.json").schema).toBe("HwHealth");
  });
  it("throws on names outside the rule", () => {
    expect(() => hwFixtureTarget("request.lights.json")).toThrow();
    expect(() => hwFixtureTarget("foo.bar.json")).toThrow();
    expect(() => hwFixtureTarget("event.lights.state.txt")).toThrow();
  });
});
```
`packages/contracts/test/hw-fixtures.test.ts`
```ts
import { describe, expect, it } from "vitest";
import type { z } from "zod";
import * as hw from "../src/hw/index.ts";
import { hwFixtureTarget } from "./hw-fixture-name.ts";
import { listFixtures, readFixture } from "./helpers.ts";

const schemas: Record<string, z.ZodType> = { ...hw };
const files = listFixtures("hw");
const targets = files.map((file) => hwFixtureTarget(file));

describe("hw fixtures", () => {
  it.each(files)("%s parses with its schema", (file) => {
    const target = hwFixtureTarget(file);
    const schema = schemas[target.schema];
    expect(schema, `no exported schema named ${target.schema}`).toBeDefined();
    if (schema === undefined) return;
    const result = schema.safeParse(readFixture(`hw/${file}`));
    expect(result.error?.issues ?? []).toEqual([]);
    if (target.kind === "event") {
      expect(result.data).toMatchObject({ type: target.eventType });
    }
  });

  it("has exactly one fixture per HwEvent type", () => {
    const eventTypes = hw.HwEvent.options.map((option) => option.shape.type.value).sort();
    const fixtureTypes = targets.flatMap((t) => (t.kind === "event" ? [t.eventType] : [])).sort();
    expect(fixtureTypes).toEqual(eventTypes);
  });

  it("has a fixture for every Hw*Request schema", () => {
    const covered = new Set(targets.map((t) => t.schema));
    const missing = Object.keys(schemas).filter((name) => name.endsWith("Request") && !covered.has(name));
    expect(missing).toEqual([]);
  });

  it("has fixtures for every response schema", () => {
    const covered = new Set(targets.map((t) => t.schema));
    for (const name of ["HwAck", "HwHealth", "HwSnapshot", "HwIrLearnResult"]) {
      expect(covered.has(name), name).toBe(true);
    }
  });
});
```

**Verify:** `pnpm --filter @eduscope/contracts test` → 31 "parses with its schema" cases plus 3 coverage
tests and 4 name-rule tests pass; `ls packages/contracts/fixtures/hw | wc -l` prints `31`; `pnpm verify` green.

**Commit:** `git commit -m "test(contracts): hw golden fixtures and naming rule"`

---

### T16 — `export-hw-schema` and the committed JSON Schema
- [ ] done

**Files:** `packages/contracts/scripts/hw-json-schema.ts`, `packages/contracts/scripts/export-hw-schema.ts`,
`packages/contracts/package.json`, `packages/contracts/generated/hw.schema.json` (generated),
`packages/contracts/test/hw-json-schema.test.ts`

**Context:** ARCHITECTURE §3.4 step 1; CLAUDE.md command `pnpm --filter @eduscope/contracts export-hw-schema`;
M01 AC5 (regenerating gives no git diff). Output must be deterministic: names sorted, 2-space JSON,
trailing newline.

**Do:**
1. Create `packages/contracts/scripts/hw-json-schema.ts`:
   ```ts
   import { z } from "zod";
   import * as hw from "../src/hw/index.ts";

   /** JSON Schema for every hw/* zod schema, keyed by schema name (sorted). */
   export function buildHwJsonSchema(): string {
     const schemas: Record<string, z.ZodType> = { ...hw };
     const out: Record<string, unknown> = {};
     for (const name of Object.keys(schemas).sort()) {
       const schema = schemas[name];
       if (schema !== undefined) {
         out[name] = z.toJSONSchema(schema);
       }
     }
     const document = {
       $comment: "Generated by `pnpm --filter @eduscope/contracts export-hw-schema`. Do not edit.",
       schemas: out,
     };
     return `${JSON.stringify(document, null, 2)}\n`;
   }
   ```
2. Create `packages/contracts/scripts/export-hw-schema.ts`:
   ```ts
   import { mkdirSync, writeFileSync } from "node:fs";
   import { fileURLToPath } from "node:url";
   import { buildHwJsonSchema } from "./hw-json-schema.ts";

   const dir = new URL("../generated/", import.meta.url);
   const target = new URL("hw.schema.json", dir);
   mkdirSync(dir, { recursive: true });
   writeFileSync(target, buildHwJsonSchema());
   console.log(`wrote ${fileURLToPath(target)}`);
   ```
3. Add to `packages/contracts/package.json` scripts: `"export-hw-schema": "tsx scripts/export-hw-schema.ts"`.
4. Run `pnpm --filter @eduscope/contracts export-hw-schema` and commit the generated file.

**Test:** `packages/contracts/test/hw-json-schema.test.ts`
```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildHwJsonSchema } from "../scripts/hw-json-schema.ts";

describe("generated/hw.schema.json", () => {
  it("is up to date (run export-hw-schema after changing src/hw)", () => {
    const committed = readFileSync(new URL("../generated/hw.schema.json", import.meta.url), "utf8");
    expect(committed).toBe(buildHwJsonSchema());
  });
  it("forbids extra properties on requests", () => {
    const doc: unknown = JSON.parse(buildHwJsonSchema());
    expect(doc).toMatchObject({ schemas: { HwLightsSetRequest: { additionalProperties: false } } });
  });
});
```

**Verify:**
`pnpm --filter @eduscope/contracts export-hw-schema && git diff --exit-code packages/contracts/generated/`
→ prints `wrote …/hw.schema.json`, then exits 0 on the second run after committing; `pnpm verify` green.

**Commit:** `git commit -m "feat(contracts): export hw JSON schema"`

---

### T17 — Kiosk app scaffold (Vite + React + Vitest)
- [ ] done

**Files:** `apps/kiosk/package.json`, `apps/kiosk/index.html`, `apps/kiosk/vite.config.ts`,
`apps/kiosk/vitest.config.ts`, `apps/kiosk/tsconfig.json`, `apps/kiosk/tsconfig.node.json`,
`apps/kiosk/.env.development`, `apps/kiosk/src/main.tsx`

**Context:** ARCHITECTURE §1 (`apps/kiosk`), §4.4 (`VITE_API_MODE=mock` in `.env.development`), §2 (Vite on
`:5173` with `--host`). No router, no TanStack Query yet (M02). The `/api` proxy is added in M02/M08.

**Do:**
1. Create `apps/kiosk/package.json`:
   ```json
   {
     "name": "@eduscope/kiosk",
     "version": "0.0.0",
     "private": true,
     "type": "module",
     "scripts": {
       "dev": "vite",
       "build": "vite build",
       "preview": "vite preview",
       "typecheck": "tsc -p tsconfig.json && tsc -p tsconfig.node.json",
       "test": "vitest run"
     },
     "dependencies": {
       "@eduscope/contracts": "workspace:*"
     }
   }
   ```
2. `pnpm --filter @eduscope/kiosk add react@^19.2.0 react-dom@^19.2.0`
3. `pnpm --filter @eduscope/kiosk add -D typescript@~6.0.3 vite@^8.0.0 @vitejs/plugin-react@^6.0.0 vitest@^5.0.0 @types/react@^19.2.0 @types/react-dom@^19.2.0 @types/node@^22.0.0`
4. Create `apps/kiosk/tsconfig.json`:
   ```json
   {
     "extends": "../../tsconfig.base.json",
     "compilerOptions": {
       "lib": ["ES2023", "DOM", "DOM.Iterable"],
       "jsx": "react-jsx",
       "types": ["vite/client"],
       "paths": { "@/*": ["./src/*"] }
     },
     "include": ["src"]
   }
   ```
5. Create `apps/kiosk/tsconfig.node.json`:
   ```json
   {
     "extends": "../../tsconfig.base.json",
     "compilerOptions": { "types": ["node"] },
     "include": ["vite.config.ts", "vitest.config.ts"]
   }
   ```
6. Create `apps/kiosk/vite.config.ts`:
   ```ts
   import { fileURLToPath, URL } from "node:url";
   import react from "@vitejs/plugin-react";
   import { defineConfig } from "vite";

   export default defineConfig({
     plugins: [react()],
     resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
     server: { host: true, port: 5173, strictPort: true },
   });
   ```
7. Create `apps/kiosk/vitest.config.ts` (`css.include` makes `tokens.css?raw` return its text in T18's test):
   ```ts
   import { fileURLToPath, URL } from "node:url";
   import { defineConfig } from "vitest/config";

   export default defineConfig({
     resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
     test: {
       include: ["src/**/*.test.{ts,tsx}"],
       environment: "node",
       passWithNoTests: true,
       css: { include: [/tokens\.css/] },
     },
   });
   ```
8. Create `apps/kiosk/.env.development` containing exactly `VITE_API_MODE=mock` and a newline (non-secret;
   it is committed).
9. Create `apps/kiosk/index.html`:
   ```html
   <!doctype html>
   <html lang="en">
     <head>
       <meta charset="UTF-8" />
       <meta name="viewport" content="width=device-width, initial-scale=1" />
       <meta name="color-scheme" content="dark" />
       <title>Eduscope Central</title>
     </head>
     <body>
       <div id="root"></div>
       <script type="module" src="/src/main.tsx"></script>
     </body>
   </html>
   ```
10. Create `apps/kiosk/src/main.tsx`:
    ```tsx
    import { StrictMode } from "react";
    import { createRoot } from "react-dom/client";

    const rootElement = document.getElementById("root");
    if (rootElement === null) {
      throw new Error("index.html is missing #root");
    }
    createRoot(rootElement).render(
      <StrictMode>
        <main>eduscope</main>
      </StrictMode>,
    );
    ```

**Verify:** `pnpm install && pnpm --filter @eduscope/kiosk typecheck && pnpm --filter @eduscope/kiosk build`
→ build prints `✓ built`; `pnpm verify` green (kiosk test prints "No test files found" and exits 0).

**Commit:** `git commit -m "feat(kiosk): Vite React scaffold"`

---

### T18 — Design tokens, Tailwind v4 and self-hosted fonts
- [ ] done

**Files:** `apps/kiosk/src/styles/tokens.css`, `apps/kiosk/src/styles/index.css`,
`apps/kiosk/src/styles/token-names.ts`, `apps/kiosk/src/styles/token-names.test.ts`,
`apps/kiosk/vite.config.ts` (modify), `apps/kiosk/src/main.tsx` (modify), `apps/kiosk/package.json` (deps)

**Context:** ARCHITECTURE §4.2 (tokens.css), D-10; SPEC §3.1 (colours, values verbatim), §3.2 (type scale),
§3.3 (radii), §2.2 (breakpoints 600/1024). Deviations from the ARCHITECTURE §4.2 snippet, both required:
- `@theme static` instead of `@theme`: Tailwind v4 drops theme variables that no utility class uses, and the
  swatch page reads colours through `var(--color-…)`. Verified in a prototype.
- The type scale adds `--text-date` (SPEC §3.2 "Date 13"); ARCHITECTURE's list omits it.
The shadcn variable mapping lives here too (T19 points shadcn at this file). The shadcn names
`accent` and `border` are **not** remapped in `@theme inline`, because ours already exist
(`accent` = green). No new colours anywhere.

**Do:**
1. `pnpm --filter @eduscope/kiosk add @fontsource-variable/inter@^5.2.0 @fontsource-variable/jetbrains-mono@^5.2.0`
2. `pnpm --filter @eduscope/kiosk add -D tailwindcss@^4.3.0 @tailwindcss/vite@^4.3.0`
3. In `apps/kiosk/vite.config.ts` add `import tailwindcss from "@tailwindcss/vite";` and change
   `plugins: [react()]` to `plugins: [react(), tailwindcss()]`.
4. Create `apps/kiosk/src/styles/tokens.css`:
   ```css
   /* The ONLY file with raw colour values (CLAUDE.md, ARCHITECTURE §4.2). Values: SPEC §3.1–3.3. */
   @import "tailwindcss";

   /* static: emit every variable even when no utility class uses it */
   @theme static {
     --breakpoint-sm: 600px;
     --breakpoint-md: initial;
     --breakpoint-lg: 1024px;
     --breakpoint-xl: initial;
     --breakpoint-2xl: initial;

     --color-bg: #0E1621;
     --color-header: #121B27;
     --color-surface: #151F2C;
     --color-surface-2: #1B2635;
     --color-control: #1C2938;
     --color-border: #243140;
     --color-border-strong: #33414F;
     --color-border-dashed: #3A4757;
     --color-text-1: #E6EBF0;
     --color-text-2: #9AA6B2;
     --color-text-3: #6C7A88;
     --color-accent: #34D399;
     --color-accent-fill: #1E3A2B;
     --color-accent-border: #3FCF7F;
     --color-selected-fill: #1B3A48;
     --color-toggle-on: #3A9A5F;
     --color-toggle-off: #2A3644;
     --color-knob: #F2F4F6;
     --color-warn: #F2A93B;
     --color-warn-fill: #3B2A10;
     --color-brand: #E5483F;
     --color-danger: #F0524F;
     --color-danger-fill: #3A1618;
     --color-callout-fill: #11261C;
     --color-callout-border: #2F7A50;
     --color-badge-router-fill: #1F4A33;
     --color-badge-router-text: #4ADE80;

     --radius-card: 10px;
     --radius-btn: 8px;
     --radius-chip: 6px;

     --font-sans: "Inter Variable", system-ui, sans-serif;
     --font-mono: "JetBrains Mono Variable", ui-monospace, monospace;

     /* Type scale, SPEC §3.2 (px on the 1280 canvas). Weight/face are set with classes. */
     --text-wordmark: 24px;
     --text-wordmark--line-height: 32px;
     --text-clock: 28px;
     --text-clock--line-height: 36px;
     --text-date: 13px;
     --text-date--line-height: 18px;
     --text-title: 22px;
     --text-title--line-height: 28px;
     --text-section: 11px;
     --text-section--line-height: 16px;
     --text-section--letter-spacing: 0.14em;
     --text-card-title: 16px;
     --text-card-title--line-height: 22px;
     --text-caption: 12px;
     --text-caption--line-height: 16px;
     --text-button: 15px;
     --text-button--line-height: 20px;
     --text-value: 24px;
     --text-value--line-height: 28px;
     --text-sensor-label: 10px;
     --text-sensor-label--line-height: 14px;
     --text-sensor-label--letter-spacing: 0.1em;

     --tracking-wordmark: 0.12em;
   }

   /* shadcn variables mapped onto our tokens: never new colours. */
   :root {
     color-scheme: dark;
     --background: var(--color-bg);
     --foreground: var(--color-text-1);
     --card: var(--color-surface);
     --card-foreground: var(--color-text-1);
     --popover: var(--color-surface-2);
     --popover-foreground: var(--color-text-1);
     --primary: var(--color-accent);
     --primary-foreground: var(--color-bg);
     --secondary: var(--color-control);
     --secondary-foreground: var(--color-text-1);
     --muted: var(--color-surface-2);
     --muted-foreground: var(--color-text-2);
     --accent: var(--color-surface-2);
     --accent-foreground: var(--color-text-1);
     --destructive: var(--color-danger);
     --border: var(--color-border);
     --input: var(--color-border-strong);
     --ring: var(--color-text-2);
     --radius: 8px;
   }

   /* Utility names shadcn primitives use. `accent` and `border` stay ours (see plan T18). */
   @theme inline {
     --color-background: var(--background);
     --color-foreground: var(--foreground);
     --color-card: var(--card);
     --color-card-foreground: var(--card-foreground);
     --color-popover: var(--popover);
     --color-popover-foreground: var(--popover-foreground);
     --color-primary: var(--primary);
     --color-primary-foreground: var(--primary-foreground);
     --color-secondary: var(--secondary);
     --color-secondary-foreground: var(--secondary-foreground);
     --color-muted: var(--muted);
     --color-muted-foreground: var(--muted-foreground);
     --color-accent-foreground: var(--accent-foreground);
     --color-destructive: var(--destructive);
     --color-input: var(--input);
     --color-ring: var(--ring);
     --radius-sm: var(--radius-chip);
     --radius-md: var(--radius-btn);
     --radius-lg: var(--radius-card);
     --radius-xl: var(--radius-card);
   }
   ```
5. Create `apps/kiosk/src/styles/index.css`:
   ```css
   @import "./tokens.css";

   @layer base {
     html,
     body,
     #root {
       min-height: 100dvh;
     }
     body {
       @apply bg-bg font-sans text-text-1 antialiased;
       overflow-x: clip;
     }
   }
   ```
6. Create `apps/kiosk/src/styles/token-names.ts`:
   ```ts
   /** Names of the design tokens in tokens.css (no values). Kept in sync by token-names.test.ts. */
   export const COLOR_TOKENS = [
     "bg", "header", "surface", "surface-2", "control", "border", "border-strong", "border-dashed",
     "text-1", "text-2", "text-3", "accent", "accent-fill", "accent-border", "selected-fill",
     "toggle-on", "toggle-off", "knob", "warn", "warn-fill", "brand", "danger", "danger-fill",
     "callout-fill", "callout-border", "badge-router-fill", "badge-router-text",
   ] as const;
   export type ColorToken = (typeof COLOR_TOKENS)[number];

   export const TYPE_TOKENS = [
     "wordmark", "clock", "date", "title", "section", "card-title", "caption", "button", "value",
     "sensor-label",
   ] as const;
   export type TypeToken = (typeof TYPE_TOKENS)[number];

   export const RADIUS_TOKENS = ["card", "btn", "chip"] as const;
   export type RadiusToken = (typeof RADIUS_TOKENS)[number];
   ```
7. Replace `apps/kiosk/src/main.tsx` with (fonts are bundled by Vite: no network font requests):
   ```tsx
   import "@fontsource-variable/inter";
   import "@fontsource-variable/jetbrains-mono";
   import "@/styles/index.css";
   import { StrictMode } from "react";
   import { createRoot } from "react-dom/client";

   const rootElement = document.getElementById("root");
   if (rootElement === null) {
     throw new Error("index.html is missing #root");
   }
   createRoot(rootElement).render(
     <StrictMode>
       <main className="p-4 font-mono text-clock">eduscope</main>
     </StrictMode>,
   );
   ```

**Test:** `apps/kiosk/src/styles/token-names.test.ts`
```ts
import { describe, expect, it } from "vitest";
import { COLOR_TOKENS, RADIUS_TOKENS, TYPE_TOKENS } from "./token-names";
import tokensCss from "./tokens.css?raw";

const captured = (pattern: RegExp): string[] =>
  [...tokensCss.matchAll(pattern)].map((match) => match[1] ?? "").sort();

describe("token-names", () => {
  it("lists every colour token defined with a literal in tokens.css", () => {
    expect(captured(/--color-([a-z0-9-]+):\s*#/g)).toEqual([...COLOR_TOKENS].sort());
  });
  it("has all 27 SPEC §3.1 colours", () => {
    expect(COLOR_TOKENS).toHaveLength(27);
  });
  it("lists every type-scale token", () => {
    expect(captured(/--text-([a-z]+(?:-[a-z]+)*):\s*\d+px/g)).toEqual([...TYPE_TOKENS].sort());
  });
  it("lists every radius token", () => {
    expect(captured(/--radius-([a-z]+):\s*\d+px/g)).toEqual([...RADIUS_TOKENS].sort());
  });
  it("keeps only the sm (600) and lg (1024) breakpoints", () => {
    expect(tokensCss).toContain("--breakpoint-sm: 600px;");
    expect(tokensCss).toContain("--breakpoint-lg: 1024px;");
    for (const removed of ["md", "xl", "2xl"]) {
      expect(tokensCss).toContain(`--breakpoint-${removed}: initial;`);
    }
  });
});
```

**Verify:**
1. `pnpm --filter @eduscope/kiosk test` → `token-names.test.ts` 5 passed.
2. `pnpm --filter @eduscope/kiosk build && grep -oE '@media[^{]*' apps/kiosk/dist/assets/*.css | sort -u`
   → only `(width>=600px)` and `(width>=1024px)` appear (`768`/`1280`/`1536` must not).
3. `grep -c 'color-knob' apps/kiosk/dist/assets/*.css` → ≥ 1 (proves `@theme static` emits unused tokens).
4. `ls apps/kiosk/dist/assets | grep -c woff2` → ≥ 2.
5. `pnpm verify` green.

**Commit:** `git commit -m "feat(kiosk): design tokens, Tailwind v4 theme and self-hosted fonts"`

---

### T19 — shadcn configuration with `ui/` as the components path
- [ ] done

**Files:** `apps/kiosk/components.json`, `apps/kiosk/src/lib/utils.ts`, `apps/kiosk/src/styles/index.css`
(modify), `apps/kiosk/package.json` (deps)

**Context:** ARCHITECTURE §1 (`ui/` = shadcn primitives only), §4.8; M01 Scope "shadcn initialised with
`ui/` as the components path and its variables mapped onto tokens". **Do not run `shadcn init`**: it is
interactive and rewrites the CSS with new colour literals. Writing its two outputs by hand is equivalent
(checked against the shadcn 4.21 CLI with `add --dry-run`). No primitive is added in M01 (M02 adds them).

**Do:**
1. `pnpm --filter @eduscope/kiosk add clsx@^2.1.1 tailwind-merge@^3.3.0 class-variance-authority@^0.7.1 tw-animate-css@^1.4.0`
2. Create `apps/kiosk/components.json`:
   ```json
   {
     "$schema": "https://ui.shadcn.com/schema.json",
     "style": "new-york",
     "rsc": false,
     "tsx": true,
     "tailwind": {
       "config": "",
       "css": "src/styles/tokens.css",
       "baseColor": "neutral",
       "cssVariables": true,
       "prefix": ""
     },
     "iconLibrary": "lucide",
     "aliases": {
       "components": "@/components",
       "utils": "@/lib/utils",
       "ui": "@/ui",
       "lib": "@/lib",
       "hooks": "@/lib/hooks"
     }
   }
   ```
3. Create `apps/kiosk/src/lib/utils.ts`:
   ```ts
   import { clsx, type ClassValue } from "clsx";
   import { twMerge } from "tailwind-merge";

   /** shadcn class combiner: later Tailwind classes win over earlier conflicting ones. */
   export function cn(...inputs: ClassValue[]): string {
     return twMerge(clsx(inputs));
   }
   ```
4. In `apps/kiosk/src/styles/index.css` add `@import "tw-animate-css";` on the line after
   `@import "./tokens.css";`.

**Verify:**
1. `cd apps/kiosk && pnpm dlx shadcn@4.21.4 add button --dry-run; cd ../..` → output lists
   `+ src/ui/button.tsx  create` (path under `src/ui/`) and writes nothing (`git status --short` shows only
   this task's files).
2. `pnpm --filter @eduscope/kiosk build` succeeds; `pnpm verify` green.

**Commit:** `git commit -m "chore(kiosk): shadcn configuration mapped to tokens"`

---

### T20 — Folder skeleton and placeholder packages
- [ ] done

**Files:** `.gitkeep` files listed below; `apps/core-api/package.json`

**Context:** ARCHITECTURE §1 folder tree; M01 Out of scope: core-api and hw-service code are empty folders
only; M01 Scope: "CLAUDE.md commands verified to exist (create stubs for scripts that later milestones
fill)". The core-api stub has no `typecheck`/`test` scripts; root scripts use `--if-present`.

**Do:**
1. Create an empty `.gitkeep` in each folder:
   `apps/kiosk/src/ui/`, `apps/kiosk/src/components/`,
   `apps/kiosk/src/features/control/`, `apps/kiosk/src/features/devices/`, `apps/kiosk/src/features/settings/`,
   `apps/kiosk/src/features/pin/`, `apps/kiosk/src/features/session/`, `apps/kiosk/src/features/kiosk/`,
   `apps/kiosk/src/data/adapters/http/`, `apps/kiosk/src/data/adapters/mock/`,
   `apps/kiosk/src/data/realtime/`, `apps/kiosk/src/data/commands/`,
   `apps/core-api/src/`, `apps/core-api/drizzle/`, `services/hw/`.
2. Create `apps/core-api/package.json`:
   ```json
   {
     "name": "@eduscope/core-api",
     "version": "0.0.0",
     "private": true,
     "type": "module",
     "scripts": {
       "dev": "node -e \"console.log('@eduscope/core-api: placeholder until M08')\"",
       "build": "node -e \"console.log('@eduscope/core-api: placeholder until M08')\"",
       "db:generate": "node -e \"console.log('@eduscope/core-api: db:generate arrives in M08')\""
     }
   }
   ```
3. Run `pnpm install` (registers the new workspace package).

**Verify:** `pnpm --filter @eduscope/core-api dev` prints the placeholder line and exits 0;
`pnpm build` exits 0 (contracts builds before kiosk; the core-api stub prints its placeholder); `pnpm verify` green.

**Commit:** `git commit -m "chore: folder skeleton and core-api placeholder"`

---

### T21 — Temporary token swatch page at `/`
- [ ] done

**Files:** `apps/kiosk/src/app/TokenSwatches.tsx`, `apps/kiosk/src/main.tsx` (modify)

**Context:** M01 Scope "temporary `/` page `TokenSwatches`"; AC2 (bg `#0E1621`, every SPEC §3.1 token
labelled by name, sans vs mono visibly different, no network font requests), AC3 (no hex in TS), AC7 (no
horizontal scroll at 390px). No routing (M02 replaces `main.tsx`'s render). No interactive elements, so no
touch-target or pressed-state concerns. Colours come only from `var(--color-…)` and token classes.

Layout:
- Phone (base, 390px): `px-4`, colour grid `grid-cols-2`, type rows stack (`flex-col`), radius row `grid-cols-3`.
- `sm:` (≥600): colour grid `sm:grid-cols-3`, type rows `sm:flex-row sm:items-baseline sm:justify-between`,
  font samples `sm:grid-cols-2`.
- `lg:` (≥1024): `lg:px-6`, colour grid `lg:grid-cols-6`.
- Long names wrap with `break-all`; the page never sets a fixed width wider than the viewport.

**Do:**
1. Create `apps/kiosk/src/app/TokenSwatches.tsx`:
   ```tsx
   import {
     COLOR_TOKENS, RADIUS_TOKENS, TYPE_TOKENS, type RadiusToken, type TypeToken,
   } from "@/styles/token-names";

   // Temporary M01 page. M02 replaces it with the router.

   // Literal class strings so Tailwind generates them.
   const TYPE_CLASS: Record<TypeToken, string> = {
     wordmark: "text-wordmark font-bold",
     clock: "text-clock font-mono font-semibold",
     date: "text-date font-mono text-text-2",
     title: "text-title font-bold",
     section: "text-section font-bold uppercase text-text-2",
     "card-title": "text-card-title font-semibold",
     caption: "text-caption text-text-2",
     button: "text-button font-semibold",
     value: "text-value font-mono font-semibold",
     "sensor-label": "text-sensor-label font-bold uppercase text-text-2",
   };

   const TYPE_SAMPLE: Record<TypeToken, string> = {
     wordmark: "eduscope",
     clock: "10:42",
     date: "Mon 5 Oct",
     title: "Zigbee devices",
     section: "Display",
     "card-title": "Projector",
     caption: "On · confirmed by draw",
     button: "Power on",
     value: "287 W",
     "sensor-label": "Temperature",
   };

   const RADIUS_CLASS: Record<RadiusToken, string> = {
     card: "rounded-card",
     btn: "rounded-btn",
     chip: "rounded-chip",
   };

   export function TokenSwatches() {
     return (
       <main className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-6">
         <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
           <h1 className="text-wordmark font-bold">
             eduscope <span className="tracking-wordmark text-brand">CENTRAL</span>
           </h1>
           <p className="text-caption text-text-2">Design tokens · temporary M01 page</p>
         </header>

         <section aria-labelledby="tokens-colour" className="mt-8">
           <h2 id="tokens-colour" className="text-section font-bold uppercase text-text-2">Colour</h2>
           <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
             {COLOR_TOKENS.map((name) => (
               <li key={name} className="rounded-card border border-border bg-surface p-3">
                 <div
                   className="h-12 rounded-btn border border-border-strong"
                   style={{ backgroundColor: `var(--color-${name})` }}
                 />
                 <p className="mt-2 break-all font-mono text-caption text-text-1">{name}</p>
               </li>
             ))}
           </ul>
         </section>

         <section aria-labelledby="tokens-type" className="mt-8">
           <h2 id="tokens-type" className="text-section font-bold uppercase text-text-2">Typography</h2>
           <div className="mt-3 grid gap-3 sm:grid-cols-2">
             <div className="rounded-card border border-border bg-surface p-4">
               <p className="text-caption text-text-2">font-sans · Inter Variable</p>
               <p className="mt-1 font-sans text-card-title">Lecturer microphone 0123456789</p>
             </div>
             <div className="rounded-card border border-border bg-surface p-4">
               <p className="text-caption text-text-2">font-mono · JetBrains Mono Variable</p>
               <p className="mt-1 font-mono text-card-title">10:42 · 287 W · R-101 · LQI 214</p>
             </div>
           </div>
           <ul className="mt-3 divide-y divide-border rounded-card border border-border bg-surface">
             {TYPE_TOKENS.map((name) => (
               <li
                 key={name}
                 className="flex flex-col gap-1 p-4 sm:flex-row sm:items-baseline sm:justify-between"
               >
                 <span className={TYPE_CLASS[name]}>{TYPE_SAMPLE[name]}</span>
                 <span className="font-mono text-caption text-text-3">text-{name}</span>
               </li>
             ))}
           </ul>
         </section>

         <section aria-labelledby="tokens-radius" className="mt-8">
           <h2 id="tokens-radius" className="text-section font-bold uppercase text-text-2">Radius</h2>
           <ul className="mt-3 grid grid-cols-3 gap-3">
             {RADIUS_TOKENS.map((name) => (
               <li key={name} className="flex flex-col items-center gap-2">
                 <div className={`h-16 w-full border-2 border-accent-border bg-accent-fill ${RADIUS_CLASS[name]}`} />
                 <span className="font-mono text-caption text-text-2">rounded-{name}</span>
               </li>
             ))}
           </ul>
         </section>
       </main>
     );
   }
   ```
2. In `apps/kiosk/src/main.tsx`: add `import { TokenSwatches } from "@/app/TokenSwatches";` after the
   `react-dom/client` import, and replace `<main className="p-4 font-mono text-clock">eduscope</main>` with
   `<TokenSwatches />`.

**Verify:**
1. `grep -rEn "#[0-9A-Fa-f]{3,8}\b" apps/kiosk/src --include='*.tsx' --include='*.ts'` → no output.
2. `pnpm --filter @eduscope/kiosk build` succeeds; `pnpm verify` green.

**Commit:** `git commit -m "feat(kiosk): temporary token swatch page"`

---

### T22 — Acceptance walk-through (M01 criteria + CLAUDE.md commands)
- [ ] done

**Files:** `docs/plans/PLAN-M01-foundation.md` (tick boxes only). No code changes. If any check fails, do
not fix it here: write a Blocker naming the failing criterion and stop.

**Do / Verify** (run from the repo root, in order):

| # | Criterion | Command / check | Pass |
|---|---|---|---|
| AC1 | Fresh clone installs and verifies | `rm -rf "${TMPDIR:-/tmp}/m01-clone" && git clone --quiet . "${TMPDIR:-/tmp}/m01-clone" && (cd "${TMPDIR:-/tmp}/m01-clone" && pnpm install && pnpm verify); echo "exit=$?"` | `exit=0` |
| AC2 | Swatch page on `bg`, every token labelled, two fonts, no network fonts | **[HUMAN]** checkpoint below | human confirms |
| AC3 | No hex in kiosk TS | `grep -rEn "#[0-9A-Fa-f]{3,8}\b" apps/kiosk/src --include='*.tsx' --include='*.ts'; echo "exit=$?"` | no matches, `exit=1` |
| AC4 | Contract tests | the AC4 command below the table | the RoomState line, 31 "parses with its schema" lines, the confidence line and the `rejects {kind:"occupancy", value:"open"}` line, all ✓ |
| AC5 | Schema export is stable | `pnpm --filter @eduscope/contracts export-hw-schema && git diff --exit-code packages/contracts/generated/; echo "exit=$?"` | `exit=0` |
| AC6 | `any` breaks verify | `printf 'const x: any = 1;\nexport { x };\n' > apps/kiosk/src/any-probe.ts; pnpm verify; echo "exit=$?"; rm apps/kiosk/src/any-probe.ts` | non-zero exit with `@typescript-eslint/no-explicit-any`; afterwards `git status --short` is clean |
| AC7 | No horizontal scroll at 390px | **[HUMAN]** checkpoint below | human confirms |

AC4 command:
```sh
pnpm --filter @eduscope/contracts exec vitest run --reporter=verbose 2>&1 \
  | grep -E 'room-normal.json parses as RoomState|parses with its schema|rejects a missing confidence|occupancy'
```

CLAUDE.md command inventory (each must exist now or be a named stub):

| Command | Expected now |
|---|---|
| `pnpm install` | works |
| `pnpm dev` | starts Vite on :5173 (core-api stub prints its placeholder and exits); stop with Ctrl-C |
| `pnpm --filter @eduscope/kiosk dev` | Vite on :5173 |
| `pnpm --filter @eduscope/core-api dev` | placeholder line (M08) |
| `pnpm verify`, `pnpm -r test`, `pnpm -r typecheck`, `pnpm lint`, `pnpm build` | exit 0 |
| `pnpm hw:test`, `pnpm hw:lint` | no-op line (M07) |
| `pnpm --filter <pkg> test` / `typecheck` / `build` | exit 0 for contracts and kiosk |
| `pnpm --filter @eduscope/core-api db:generate` | placeholder line (M08) |
| `pnpm --filter @eduscope/contracts export-hw-schema` | writes the file (AC5) |
| `uv sync --directory services/hw`, `uv run --directory services/hw …` | **not yet** — M07 creates `services/hw/pyproject.toml`; do not run |

When every row passes and the human confirms the checkpoint, tick this task.

**Commit:** `git commit -m "chore: M01 acceptance walk-through"`

## Checkpoints

- **After T18:** "Human: run `pnpm --filter @eduscope/kiosk dev`, open `http://localhost:5173`. The page
  background is the dark navy `bg` and 'eduscope' renders in JetBrains Mono at clock size. Stop the server."
- **After T21 (= AC2 + AC7):** "Human: run `pnpm --filter @eduscope/kiosk dev` and open
  `http://localhost:5173` in Chromium.
  1. At 1280×800 compare with `reference/screens/01-control-page.png`. The background matches, the 27
     colour swatches are each labelled (`bg` … `badge-router-text`), and the 'CENTRAL' wordmark is brand red
     with wide tracking.
  2. The sans sample (Inter) and the mono sample (JetBrains Mono, slashed zero, fixed width) look clearly
     different.
  3. DevTools → Network → filter `font` → reload: every `.woff2` comes from `localhost:5173`, with
     no requests to Google or another CDN.
  4. DevTools device toolbar at 390px wide: no horizontal scrollbar. Swatches are 2 per row and type rows
     stack.
  Reply 'continue' or describe the mismatch."

## Blockers
(executor writes here; leave empty)

## Nice-to-haves (not tasks)
- Prettier (or Biome) for formatting TS/JSON consistently.
- A CI workflow running `pnpm verify` on push.
- `eslint-plugin-react-refresh` once shadcn primitives exist.
- Vite dev proxy for `/api` and `/ws` (lands with M02/M08 anyway).
- A `pre-commit` hook that runs `export-hw-schema` and fails on diff.

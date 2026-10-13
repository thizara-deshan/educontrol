import { z } from "zod";

// zod at the env boundary (CLAUDE.md, ARCHITECTURE §6.1). Every knob core-api reads lives here.

const Bool = z.enum(["true", "false"]).transform((value) => value === "true");
const Ms = z.coerce.number().int().positive();

export const Config = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().min(1).default("0.0.0.0"),
  DB_PATH: z.string().min(1),
  HW_URL: z.url().default("http://127.0.0.1:8081"),
  /** Signs the `ec_sid` cookie. */
  COOKIE_SECRET: z.string().min(32, "COOKIE_SECRET must be at least 32 characters"),
  ROOM_ID: z.string().min(1).default("R-101"),
  ROOM_HOSTNAME: z.string().min(1).default("r-101.local"),
  /** D-09: a loopback socket address is the kiosk. Off unless set (dev's Vite proxy makes everyone local). */
  LOCALHOST_IS_KIOSK: Bool.default(false),
  /** Seeded into `settings` on first boot only (ARCHITECTURE §5). */
  INITIAL_ROOM_PIN: z.string().regex(/^\d{4}$/, "INITIAL_ROOM_PIN must be 4 digits").optional(),
  INITIAL_TECH_PIN: z.string().regex(/^\d{6}$/, "INITIAL_TECH_PIN must be 6 digits").optional(),
  /** Built SPA (apps/kiosk/dist). Unset in dev: Vite serves the SPA. */
  KIOSK_DIST: z.string().min(1).optional(),
  /** Dev only: give the seeded IR commands the codes the fake hw-service reacts to. */
  SEED_FAKE_IR_CODES: Bool.default(false),
  // Per-transport command timeouts (ARCHITECTURE §6.3, Q12 [ASSUMED]).
  TIMEOUT_ZIGBEE_MS: Ms.default(5000),
  TIMEOUT_IR_SEND_MS: Ms.default(3000),
  TIMEOUT_HDMI_MS: Ms.default(5000),
  TIMEOUT_MIXER_MS: Ms.default(2000),
  TIMEOUT_SCREEN_MS: Ms.default(5000),
  /** §6.7: hw down this long ⇒ every hw-backed device offline. */
  HW_DOWN_GRACE_MS: Ms.default(10_000),
  /** §6.3: no SSE frame this long ⇒ the stream is dead and reconnects. */
  HW_STREAM_DEAD_MS: Ms.default(15_000),
  // R13 expected report intervals [ASSUMED] (Q12); stale after 2×.
  CLIMATE_REPORT_INTERVAL_S: z.coerce.number().int().positive().default(300),
  POWER_REPORT_INTERVAL_S: z.coerce.number().int().positive().default(60),
});

export type Config = z.infer<typeof Config>;

/** Parses `process.env`; prints every problem and exits on a bad environment. */
export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const parsed = Config.safeParse(env);
  if (parsed.success) return parsed.data;
  const lines = parsed.error.issues.map((issue) => `  ${issue.path.join(".")}: ${issue.message}`);
  throw new Error(`Invalid core-api environment:\n${lines.join("\n")}`);
}

import type { IrBlaster, IrCommand, IrDevice, IrTransport } from "@eduscope/contracts";
import type { ValueTone } from "@/components/state-styles";
import { formatAgo } from "@/lib/format";

// S3.E7–E14 selectors (Q22, H20, R5, R8). Pure; the cards only render what these return.

/** R8: "via ZS06" / "via MCU". */
export const TRANSPORT_LABEL: Record<IrTransport, string> = { ir_zs06: "ZS06", ir_mcu: "MCU" };
const CODE_FORMAT_LABEL: Record<IrCommand["code_format"], string> = { tuya: "Tuya code" };
const COUNT_WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"] as const;

export interface ToneText {
  text: string;
  tone: ValueTone;
}

/** S3.E7 line 2: "Panasonic · via ZS06". */
export function deviceSubtitle(device: Pick<IrDevice, "brand" | "transport">): string {
  return [device.brand, `via ${TRANSPORT_LABEL[device.transport]}`].filter((part) => part !== "").join(" · ");
}

/** S3.E12: "two commands", "one command", "14 commands" (words below 10). */
export function commandCountWords(count: number): string {
  const number = COUNT_WORDS[count] ?? String(count);
  return `${number} ${count === 1 ? "command" : "commands"}`;
}

/** S3.E12 right side: "Epson · two commands · via ZS06". */
export function detailSubtitle(device: IrDevice): string {
  return [device.brand, commandCountWords(device.commands.length), `via ${TRANSPORT_LABEL[device.transport]}`]
    .filter((part) => part !== "")
    .join(" · ");
}

/**
 * S3.E7 count = captured commands (Q22). Amber when any command still needs attention (not
 * captured, untested or no reaction, H20); green otherwise; grey `0` with no commands.
 */
export function deviceCount(device: IrDevice): ToneText {
  const captured = device.commands.filter((command) => command.captured).length;
  if (device.commands.length === 0) return { text: "0", tone: "faint" };
  const needsAttention = device.commands.some((command) => !command.captured || command.test !== "reacted");
  return { text: String(captured), tone: needsAttention ? "warn" : "accent" };
}

/** "just now" under a minute, then "2 min ago" (AC3: "tested ✓ just now"). */
export function testedAgo(testedAt: string, now: Date): string {
  return now.getTime() - Date.parse(testedAt) < 60_000 ? "just now" : formatAgo(testedAt, now);
}

/**
 * S3.E14 capture status of the stored code (mono, text-2 unless stated):
 * "Not captured" amber · "Tuya code · captured · untested" amber (H20) · "Tuya code · no reaction"
 * red · "Tuya code · tested ✓ 2 min ago" · "Tuya code · captured" (tested before test times were
 * kept). "Listening…" is the capture row's own state (command-row.ts).
 */
export function commandStatus(command: IrCommand, now: Date): ToneText {
  if (!command.captured) return { text: "Not captured", tone: "warn" };
  const format = CODE_FORMAT_LABEL[command.code_format];
  switch (command.test) {
    case "untested":
      return { text: `${format} · captured · untested`, tone: "warn" };
    case "no_reaction":
      return { text: `${format} · no reaction`, tone: "danger" };
    case "reacted":
      return command.tested_at === null
        ? { text: `${format} · captured`, tone: "muted" }
        : { text: `${format} · tested ✓ ${testedAgo(command.tested_at, now)}`, tone: "muted" };
  }
}

/**
 * Which device the right column shows. The route's id when it exists; otherwise (wide layout,
 * no id) the projector, else the first device — screenshot 03 opens on Projector.
 */
export function selectedDevice(devices: readonly IrDevice[], routeId: string | undefined): IrDevice | undefined {
  if (routeId !== undefined) return devices.find((device) => device.device_id === routeId);
  return devices.find((device) => device.kind === "projector") ?? devices[0];
}

export interface BlasterView {
  id: string;
  online: boolean;
  /** `LQI 196`, or H25 "Offline · last seen 5 min ago" (red). */
  link: ToneText;
  topic: string;
  coverage: string;
}

/** S3.E10 BLASTER card. Offline = `ir_blaster.online` false (H25). */
export function blasterView(blaster: IrBlaster, now: Date): BlasterView {
  const online = blaster.online.value === true;
  const since = blaster.online.updated_at;
  const link: ToneText = online
    ? { text: blaster.lqi === null ? "LQI —" : `LQI ${blaster.lqi}`, tone: "muted" }
    : { text: since === null ? "Offline" : `Offline · last seen ${formatAgo(since, now)}`, tone: "danger" };
  return { id: blaster.id, online, link, topic: blaster.topic, coverage: blaster.coverage };
}

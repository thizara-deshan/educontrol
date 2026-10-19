import {
  HwAck, HwIrLearnResult, type HwAudioLevelRequest, type HwAudioMuteRequest, type HwHdmiSelectRequest,
  type HwIrLearnRequest, type HwIrSendRequest, type HwLightsSetRequest, type HwProjectionScreenMoveRequest,
  type HwPlugSetRequest, type HwProjectorPowerRelayRequest, type HwZigbeeStatusPermitJoinRequest,
} from "@eduscope/contracts";
import type { z } from "zod";

// ARCHITECTURE §3.4 / §6.3: core-api → hw-service commands. Every outcome is an HwAck: an
// unreachable service, a timeout or a bad answer become `{ok:false}` so the dispatcher has one path.
// A learn answers HwIrLearnResult instead, or `failed` when hw-service could not be asked (§6.9).

/** `/v1/ir/learn` outcome: hw's answer, or `failed` (unreachable, HTTP timeout, bad answer). */
export type IrLearnOutcome = HwIrLearnResult | { status: "failed"; message: string };

export interface HwClient {
  lightsSet(body: HwLightsSetRequest): Promise<HwAck>;
  projectorRelay(body: HwProjectorPowerRelayRequest): Promise<HwAck>;
  irSend(body: HwIrSendRequest): Promise<HwAck>;
  /** Blocks until hw captures, times out or is cancelled (≤ timeout_s). */
  irLearn(body: HwIrLearnRequest): Promise<IrLearnOutcome>;
  irLearnCancel(): Promise<HwAck>;
  hdmiSelect(body: HwHdmiSelectRequest): Promise<HwAck>;
  screenMove(body: HwProjectionScreenMoveRequest): Promise<HwAck>;
  audioLevel(body: HwAudioLevelRequest): Promise<HwAck>;
  audioMute(body: HwAudioMuteRequest): Promise<HwAck>;
  permitJoin(body: HwZigbeeStatusPermitJoinRequest): Promise<HwAck>;
  plugSet(body: HwPlugSetRequest): Promise<HwAck>;
}

export interface HwTimeouts {
  zigbeeMs: number;
  irSendMs: number;
  irLearnMs: number;
  hdmiMs: number;
  mixerMs: number;
  screenMs: number;
  /** Not a timeout: the pause between the projector's Power off frame and its confirming repeat. */
  projectorOffConfirmMs: number;
}

type Failure = { code: "timeout" | "transport"; message: string };

export function createHwClient(options: { baseUrl: string; timeouts: HwTimeouts; fetch?: typeof fetch }): HwClient {
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  const { timeouts } = options;

  async function postParsed<S extends z.ZodType>(path: string, body: unknown, timeoutMs: number, schema: S): Promise<z.infer<S> | Failure> {
    let response: Response;
    try {
      response = await doFetch(`${options.baseUrl}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === "TimeoutError";
      return timedOut ? { code: "timeout", message: `${path}: no answer in ${timeoutMs} ms` } : { code: "transport", message: "hw-service unreachable" };
    }
    const raw: unknown = await response.json().catch(() => null);
    const parsed = schema.safeParse(raw);
    if (parsed.success) return parsed.data;
    return { code: "transport", message: `${path}: unexpected answer (HTTP ${response.status})` };
  }

  const isFailure = (value: object): value is Failure => "code" in value && "message" in value && !("ok" in value);

  async function post(path: string, body: unknown, timeoutMs: number): Promise<HwAck> {
    const result = await postParsed(path, body, timeoutMs, HwAck);
    return isFailure(result) ? { ok: false, error: result } : result;
  }

  return {
    lightsSet: (body) => post("/v1/lights/set", body, timeouts.zigbeeMs),
    projectorRelay: (body) => post("/v1/projector_power/relay", body, timeouts.zigbeeMs),
    irSend: (body) => post("/v1/ir/send", body, timeouts.irSendMs),
    async irLearn(body) {
      const result = await postParsed("/v1/ir/learn", body, timeouts.irLearnMs, HwIrLearnResult);
      return isFailure(result) ? { status: "failed", message: result.message } : result;
    },
    irLearnCancel: () => post("/v1/ir/learn/cancel", {}, timeouts.irSendMs),
    hdmiSelect: (body) => post("/v1/hdmi/select", body, timeouts.hdmiMs),
    screenMove: (body) => post("/v1/projection_screen/move", body, timeouts.screenMs),
    audioLevel: (body) => post("/v1/audio/level", body, timeouts.mixerMs),
    audioMute: (body) => post("/v1/audio/mute", body, timeouts.mixerMs),
    permitJoin: (body) => post("/v1/zigbee_status/permit_join", body, timeouts.zigbeeMs),
    plugSet: (body) => post("/v1/plug/set", body, timeouts.zigbeeMs),
  };
}

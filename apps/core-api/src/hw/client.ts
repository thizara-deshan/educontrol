import {
  HwAck, type HwAudioLevelRequest, type HwAudioMuteRequest, type HwHdmiSelectRequest, type HwIrSendRequest,
  type HwLightsSetRequest, type HwProjectionScreenMoveRequest, type HwProjectorPowerRelayRequest,
} from "@eduscope/contracts";

// ARCHITECTURE §3.4 / §6.3: core-api → hw-service commands. Every outcome is an HwAck: an
// unreachable service, a timeout or a bad answer become `{ok:false}` so the dispatcher has one path.

export interface HwClient {
  lightsSet(body: HwLightsSetRequest): Promise<HwAck>;
  projectorRelay(body: HwProjectorPowerRelayRequest): Promise<HwAck>;
  irSend(body: HwIrSendRequest): Promise<HwAck>;
  hdmiSelect(body: HwHdmiSelectRequest): Promise<HwAck>;
  screenMove(body: HwProjectionScreenMoveRequest): Promise<HwAck>;
  audioLevel(body: HwAudioLevelRequest): Promise<HwAck>;
  audioMute(body: HwAudioMuteRequest): Promise<HwAck>;
}

export interface HwTimeouts {
  zigbeeMs: number;
  irSendMs: number;
  hdmiMs: number;
  mixerMs: number;
  screenMs: number;
}

export function createHwClient(options: { baseUrl: string; timeouts: HwTimeouts; fetch?: typeof fetch }): HwClient {
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  const { timeouts } = options;

  async function post(path: string, body: unknown, timeoutMs: number): Promise<HwAck> {
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
      return timedOut
        ? { ok: false, error: { code: "timeout", message: `${path}: no answer in ${timeoutMs} ms` } }
        : { ok: false, error: { code: "transport", message: "hw-service unreachable" } };
    }
    const raw: unknown = await response.json().catch(() => null);
    const ack = HwAck.safeParse(raw);
    if (ack.success) return ack.data;
    return { ok: false, error: { code: "transport", message: `${path}: unexpected answer (HTTP ${response.status})` } };
  }

  return {
    lightsSet: (body) => post("/v1/lights/set", body, timeouts.zigbeeMs),
    projectorRelay: (body) => post("/v1/projector_power/relay", body, timeouts.zigbeeMs),
    irSend: (body) => post("/v1/ir/send", body, timeouts.irSendMs),
    hdmiSelect: (body) => post("/v1/hdmi/select", body, timeouts.hdmiMs),
    screenMove: (body) => post("/v1/projection_screen/move", body, timeouts.screenMs),
    audioLevel: (body) => post("/v1/audio/level", body, timeouts.mixerMs),
    audioMute: (body) => post("/v1/audio/mute", body, timeouts.mixerMs),
  };
}

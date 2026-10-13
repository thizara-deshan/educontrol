import type { ChangedBy, CommandBody } from "@eduscope/contracts";

// H13 activity texts ("Rear of room turned on"); the kiosk appends " · from phone" / " · by hand".

export function describeCommand(body: CommandBody): string {
  switch (body.kind) {
    case "source.select":
      return body.input === "podium_pc" ? "Podium PC selected" : "Smart board selected";
    case "projector.power":
      return body.on ? "Projector power on sent" : "Projector power off sent";
    case "projector.mains":
      return body.on ? "Projector mains turned on" : "Projector mains turned off";
    case "screen.move":
      return body.to === "raise" ? "Projection screen raised" : "Projection screen lowered";
    case "audio.level":
      return `${body.channel === "mic" ? "Lecturer microphone" : "PC audio"} set to ${body.level}`;
    case "audio.mute_all":
      return body.muted ? "All audio muted" : "All audio unmuted";
    case "lights.set":
      return `${body.gang === "front" ? "Front" : "Rear"} of room turned ${body.on ? "on" : "off"}`;
    case "ac.power":
      return body.on ? "Air conditioning turned on" : "Air conditioning turned off";
    case "ac.step":
      return body.direction === "up" ? "Air conditioning setpoint raised" : "Air conditioning setpoint lowered";
  }
}

/**
 * Who changed a reported output: the issuer of a matching in-flight command, else "by hand" for a
 * light that changed (R6), else nobody. `undefined` = the value did not change: keep what it had.
 */
export function attributionFor(output: string, changed: boolean, claimedBy: ChangedBy | null): ChangedBy | null | undefined {
  if (claimedBy !== null) return claimedBy;
  if (!changed) return undefined;
  return output.startsWith("lights.") ? "by hand" : null;
}

import type { ClientLabel } from "@eduscope/contracts";

// ARCHITECTURE §4.5, SPEC Q19 (assumption: automatic from form factor). The kiosk label
// ("room screen") is decided by the server, never by the client.
export const PODIUM_STORAGE_KEY = "eduscope.podium";
const PHONE_MAX_SHORT_SIDE = 600; // SPEC §2.2 phone breakpoint

export interface ClientTraits {
  /** `?podium=1` was seen once on this browser. */
  podium: boolean;
  /** `(pointer: coarse)` matches. */
  coarsePointer: boolean;
  /** The shorter side of the screen in CSS px. */
  shortSide: number;
}

export function detectClientLabel(traits: ClientTraits): ClientLabel {
  if (traits.podium) return "podium PC";
  if (!traits.coarsePointer) return "laptop";
  return traits.shortSide < PHONE_MAX_SHORT_SIDE ? "phone" : "tablet";
}

/** `?podium=1` is remembered in localStorage; blocked storage falls back to form factor. */
function readPodiumFlag(): boolean {
  try {
    if (new URLSearchParams(window.location.search).get("podium") === "1") {
      window.localStorage.setItem(PODIUM_STORAGE_KEY, "1");
    }
    return window.localStorage.getItem(PODIUM_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Reads the browser once at startup. */
export function getClientLabel(): ClientLabel {
  return detectClientLabel({
    podium: readPodiumFlag(),
    coarsePointer: window.matchMedia("(pointer: coarse)").matches,
    shortSide: Math.min(window.screen.width, window.screen.height),
  });
}

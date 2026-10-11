import { kioskEnv } from "@/data/env";

const STORAGE_KEY = "eduscope.mockPanel";

/** `?mock-panel` once per tab keeps the panel across in-app navigation (mock mode only). */
export function mockPanelEnabled(): boolean {
  if (kioskEnv.VITE_API_MODE !== "mock") return false;
  try {
    if (new URLSearchParams(window.location.search).has("mock-panel")) {
      window.sessionStorage.setItem(STORAGE_KEY, "1");
    }
    return window.sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return new URLSearchParams(window.location.search).has("mock-panel");
  }
}

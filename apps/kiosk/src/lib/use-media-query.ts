import { useSyncExternalStore } from "react";

/** `true` while the media query matches (e.g. `(min-width: 1024px)` = Tailwind `lg`). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Tailwind `lg` (SPEC §2.2: ≥1024). */
export const LG_QUERY = "(min-width: 1024px)";

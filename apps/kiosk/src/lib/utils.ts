import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";
import { COLOR_TOKENS, RADIUS_TOKENS, TYPE_TOKENS } from "@/styles/token-names";

// tailwind-merge must know our token names: otherwise it reads `text-section` (a font size)
// as a colour and drops it when `text-text-2` follows.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [...TYPE_TOKENS],
      color: [...COLOR_TOKENS],
      radius: [...RADIUS_TOKENS],
    },
  },
});

/** shadcn class combiner: later Tailwind classes win over earlier conflicting ones. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

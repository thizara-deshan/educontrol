import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** "DISPLAY", "ROOM SENSORS": 11px bold uppercase, tracking 0.14em, text-2 (SPEC §3.2). */
export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn("text-section font-bold uppercase text-text-2", className)}>{children}</h2>;
}

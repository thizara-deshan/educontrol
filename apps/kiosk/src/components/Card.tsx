import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CARD_VARIANT_CLASS, type CardVariant } from "./state-styles";

/** SPEC §3.3: radius 10, padding 16, 1px border on `surface`. Variant: solid / dashed / danger. */
export function Card({ variant = "solid", className, children }: { variant?: CardVariant; className?: string; children: ReactNode }) {
  return <section className={cn("rounded-card border bg-surface p-4", CARD_VARIANT_CLASS[variant], className)}>{children}</section>;
}

import { useState } from "react";
import { Card } from "@/components/Card";
import { SectionLabel } from "@/components/SectionLabel";
import { cn } from "@/lib/utils";

/** S3.E17, copy verbatim. Phone: the first sentence + "More" (SPEC §2.2); ≥600 always in full. */
export function HowCaptureWorks() {
  const [expanded, setExpanded] = useState(false);
  const rest = cn(expanded ? "inline" : "hidden", "sm:inline");
  const block = cn(expanded ? "block" : "hidden", "sm:block");
  return (
    <Card className="flex flex-col gap-3">
      <SectionLabel>How capture works</SectionLabel>
      <p className="text-button text-text-1">
        An air-conditioning remote does not send “temperature up”.
        <span className={rest}>
          {" "}
          It sends a complete state frame carrying power, mode, temperature and fan speed together. Set the handheld
          remote to exactly the state you want, then press any button — whatever is captured reproduces that whole state.
        </span>
      </p>
      <p className={cn("text-button text-text-1", block)}>
        That is why each setpoint is a separate entry rather than a plus and minus pair. The projector needs only two.
      </p>
      <p className={cn("text-caption text-text-2", block)}>
        Test every code the moment you capture it. The same button can return a different string each time, so comparing
        text proves nothing — only the hardware reacting does.
      </p>
      {!expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex h-12 min-w-12 items-center self-start text-button font-semibold text-text-2 active:text-text-1 sm:hidden"
        >
          More
        </button>
      )}
    </Card>
  );
}

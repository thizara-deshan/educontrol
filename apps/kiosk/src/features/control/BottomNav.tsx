import { usePressed } from "@/lib/use-pressed";

export const CONTROL_SECTIONS = [
  { id: "display", label: "Display" },
  { id: "audio", label: "Audio" },
  { id: "environment", label: "Environment" },
] as const;

function Segment({ id, label }: { id: string; label: string }) {
  const pressed = usePressed();
  return (
    <button
      type="button"
      {...pressed}
      onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
      className="h-12 text-button font-semibold text-text-2 active:bg-control data-[pressed=true]:bg-control"
    >
      {label}
    </button>
  );
}

/** SPEC §2.2 phone: a fixed bottom bar with three 48px segments that jump to each section. */
export function BottomNav() {
  return (
    <nav aria-label="Sections" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-border bg-header sm:hidden">
      {CONTROL_SECTIONS.map((section) => (
        <Segment key={section.id} id={section.id} label={section.label} />
      ))}
    </nav>
  );
}

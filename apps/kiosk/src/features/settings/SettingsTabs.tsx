import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { usePressed } from "@/lib/use-pressed";
import { cn } from "@/lib/utils";
import { SETTINGS_TABS, type SettingsTab } from "./tabs";

function TabLink({ to, label, active }: { to: string; label: string; active: boolean }) {
  const pressed = usePressed();
  const ref = useRef<HTMLAnchorElement>(null);
  // SPEC §2.2: on a phone the strip scrolls inside itself and the active tab is scrolled into view.
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);
  return (
    <Link
      ref={ref}
      to={to}
      aria-current={active ? "page" : undefined}
      {...pressed}
      className={cn(
        "-mb-px flex h-12 shrink-0 items-center whitespace-nowrap rounded-t-card border border-b-0 px-4 text-button font-semibold lg:h-14 lg:px-6",
        "active:brightness-125 data-[pressed=true]:brightness-125",
        active ? "border-border bg-surface text-text-1" : "border-transparent text-text-2",
      )}
    >
      {label}
    </Link>
  );
}

/**
 * S3.E5. Full-bleed band under the header; the active tab covers the band's bottom line, so it
 * looks attached to the content. The line belongs to the inner row (not the scroller), so the
 * 1px overlap never makes the strip scroll vertically.
 */
export function SettingsTabs({ active }: { active: SettingsTab }) {
  return (
    <nav aria-label="Settings" className="-mx-4 -mt-4 overflow-x-auto bg-header [scrollbar-width:none] lg:-mx-6 lg:-mt-6">
      <div className="flex w-max min-w-full gap-1 border-b border-border px-4 pt-2 lg:px-6 lg:pt-4">
        {SETTINGS_TABS.map((item) => (
          <TabLink key={item.tab} to={item.path} label={item.label} active={item.tab === active} />
        ))}
      </div>
    </nav>
  );
}

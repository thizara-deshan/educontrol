import { SectionLabel } from "@/components/SectionLabel";
import { BatteryList } from "./battery/BatteryList";
import { LightingSwitchCard } from "./routers/LightingSwitchCard";
import { ProjectorSocketCard } from "./routers/ProjectorSocketCard";

// SPEC S2 / §2.2 / ARCHITECTURE §4.1: ≥1024 main ~75% + side ~25%; below, the side column drops under
// the main one. DOM order = phone order: routers → battery → coordinator → mesh → callout → interlock.
export function DevicesPage() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-3">
        <SectionLabel>Mains powered — routers</SectionLabel>
        <LightingSwitchCard />
        <ProjectorSocketCard />
        <SectionLabel className="mt-3">Battery — end devices</SectionLabel>
        <BatteryList />
      </div>
      <div className="flex min-w-0 flex-col gap-3">
      </div>
    </div>
  );
}

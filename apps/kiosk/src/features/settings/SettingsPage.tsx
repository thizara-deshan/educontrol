import { PlaceholderPage } from "@/components/PlaceholderPage";
import { DevicesTab } from "./devices/DevicesTab";
import { NetworkTab } from "./network/NetworkTab";
import { RemoteTab } from "./remote/RemoteTab";
import { ScheduleTab } from "./schedule/ScheduleTab";
import { SettingsTabs } from "./SettingsTabs";
import type { SettingsTab } from "./tabs";

export type { SettingsTab } from "./tabs";

function TabContent({ tab }: { tab: SettingsTab }) {
  switch (tab) {
    case "remote":
      return <RemoteTab />;
    case "network":
      return <NetworkTab />;
    case "schedule":
      return <ScheduleTab />;
    case "devices":
      return <DevicesTab />;
    case "about":
      return <PlaceholderPage title="About" spec="S3e" milestone="M06" />;
  }
}

/** `/settings/*` (S3–S3e). SettingsGuard (router) keeps it technician-only; the header shows S3.E1–E4. */
export function SettingsPage({ tab }: { tab: SettingsTab }) {
  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      <SettingsTabs active={tab} />
      <TabContent tab={tab} />
    </div>
  );
}

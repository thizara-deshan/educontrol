import { PlaceholderPage } from "@/components/PlaceholderPage";
import { TechnicianAccess } from "./TechnicianAccess";

// S3.E5 tab names. SettingsGuard (router) keeps this page technician-only.
const TABS = {
  remote: { title: "Remote configuration", spec: "S3" },
  network: { title: "Network", spec: "S3b" },
  schedule: { title: "Schedule", spec: "S3c" },
  devices: { title: "Devices", spec: "S3d" },
  about: { title: "About", spec: "S3e" },
} as const;
export type SettingsTab = keyof typeof TABS;

/** `/settings/*` — placeholder until M06. */
export function SettingsPage({ tab }: { tab: SettingsTab }) {
  const { title, spec } = TABS[tab];
  return (
    <div className="flex flex-col gap-4">
      <TechnicianAccess />
      <PlaceholderPage title={`Settings › ${title}`} spec={spec} milestone="M06" />
    </div>
  );
}

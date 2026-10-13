// S3.E5 tab names and routes, in screenshot order.
export const SETTINGS_TABS = [
  { tab: "remote", label: "Remote configuration", path: "/settings/remote" },
  { tab: "network", label: "Network", path: "/settings/network" },
  { tab: "schedule", label: "Schedule", path: "/settings/schedule" },
  { tab: "devices", label: "Devices", path: "/settings/devices" },
  { tab: "about", label: "About", path: "/settings/about" },
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number]["tab"];

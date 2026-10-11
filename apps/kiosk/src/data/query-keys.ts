// The ONLY place query keys are built (ARCHITECTURE §4.4).
export const queryKeys = {
  session: () => ["session"] as const,
  state: () => ["state"] as const,
  irDevices: () => ["ir", "devices"] as const,
  schedule: () => ["schedule"] as const,
  devices: () => ["devices"] as const,
  systemNetwork: () => ["system", "network"] as const,
  systemAbout: () => ["system", "about"] as const,
};
export const STATE_ROOT_KEY = "state";

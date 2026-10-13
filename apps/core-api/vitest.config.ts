import { defineConfig } from "vitest/config";

export default defineConfig({
  // Local dates (kWh baseline) are computed in UTC in tests so results never depend on the host zone.
  test: { include: ["test/**/*.test.ts"], environment: "node", env: { TZ: "UTC" } },
});

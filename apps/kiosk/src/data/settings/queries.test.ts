import { describe, expect, it } from "vitest";
import { stubApi } from "@/data/test/api-stub";
import { aboutQuery, devicesQuery, irDevicesQuery, networkQuery, scheduleQuery } from "./queries";

describe("settings queries", () => {
  it("use the shared query keys and stay off until technician", () => {
    const api = stubApi();
    expect(irDevicesQuery(api, false)).toMatchObject({ queryKey: ["ir", "devices"], enabled: false });
    expect(scheduleQuery(api, true)).toMatchObject({ queryKey: ["schedule"], enabled: true, staleTime: Infinity });
    expect(devicesQuery(api, true)).toMatchObject({ queryKey: ["devices"], refetchOnWindowFocus: false });
    expect(networkQuery(api, false)).toMatchObject({ queryKey: ["system", "network"], enabled: false });
    expect(aboutQuery(api, true)).toMatchObject({ queryKey: ["system", "about"], staleTime: 0 });
  });
});

import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HOST, startApp } from "./app-helpers.ts";

describe("static SPA (§6.1)", () => {
  it("serves files, falls back to index.html for deep links, keeps /api 404 as JSON", async () => {
    const dist = mkdtempSync(join(tmpdir(), "kiosk-dist-"));
    writeFileSync(join(dist, "index.html"), "<!doctype html><title>Eduscope</title>");
    mkdirSync(join(dist, "assets"));
    writeFileSync(join(dist, "assets", "app.js"), "console.log(1)");
    const { app } = await startApp({ KIOSK_DIST: dist });
    const deep = await app.inject({ url: "/devices", headers: { host: HOST } });
    expect([deep.statusCode, deep.headers["content-type"], deep.body]).toEqual([200, "text/html; charset=utf-8", "<!doctype html><title>Eduscope</title>"]);
    expect((await app.inject({ url: "/", headers: { host: HOST } })).body).toContain("Eduscope");
    const js = await app.inject({ url: "/assets/app.js", headers: { host: HOST } });
    expect(js.headers["content-type"]).toContain("javascript");
    const api = await app.inject({ url: "/api/nope", headers: { host: HOST } });
    expect([api.statusCode, api.json()]).toEqual([404, { code: "not_found", message: "Not found" }]);
    await app.close();
  });

  it("without KIOSK_DIST (dev: Vite serves the SPA) every unknown path is a 404 ApiError", async () => {
    const { app } = await startApp();
    expect((await app.inject({ url: "/devices", headers: { host: HOST } })).statusCode).toBe(404);
    await app.close();
  });
});

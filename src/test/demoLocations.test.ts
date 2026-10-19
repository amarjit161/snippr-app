import { describe, expect, it, vi } from "vitest";
import { demoLocationMode, demoSalonLocationsForBuild, describeDemoBuild, isDemoFlagOn, isProductionHost } from "@/lib/demoLocations";

// When the demo salon coordinates may be used (src/lib/demoLocations.ts).

describe("demoSalonLocationsForBuild (the build-time decision used by vite.config.ts)", () => {
  it.each([
    ["true", "preview", true], // Vercel Preview with the flag
    ["true", undefined, true], // a non-Vercel demo/staging build with the flag
    ["true", "development", true],
    ["true", "production", false], // never a Vercel Production build, even with the flag
    [undefined, "preview", false], // no flag: an ordinary Preview build has no demo data
    [undefined, undefined, false],
    ["1", "preview", false], // only an explicit "true" opts in (case/space/quote-tolerant)
    ["TRUE", "preview", true],
    ["false", "preview", false],
  ])("flag %j, VERCEL_ENV %j → %s", (flag, vercelEnv, expected) => {
    expect(demoSalonLocationsForBuild(flag, vercelEnv)).toBe(expected);
  });
});

describe("isProductionHost", () => {
  it.each([["app.snippr.in"], ["snippr.in"], ["www.snippr.in"], ["APP.SNIPPR.IN"]])("%s is production", (host) => {
    expect(isProductionHost(host)).toBe(true);
  });
  it.each([["snippr-i4oihxhcj-amarjit161s-projects.vercel.app"], ["localhost"], ["127.0.0.1"], ["app.snippr.in.evil.example"]])(
    "%s is not production",
    (host) => {
      expect(isProductionHost(host)).toBe(false);
    },
  );
});

describe("demoLocationMode (runtime)", () => {
  it("the local dev server always uses them", () => {
    expect(demoLocationMode({ devServer: true, demoBuild: false, hostname: "127.0.0.1" })).toBe("dev");
  });
  it("a demo build uses them on a preview host", () => {
    expect(demoLocationMode({ devServer: false, demoBuild: true, hostname: "snippr-i4oihxhcj-amarjit161s-projects.vercel.app" })).toBe(
      "demo-build",
    );
  });
  it("a demo build never uses them on a production domain (backstop)", () => {
    expect(demoLocationMode({ devServer: false, demoBuild: true, hostname: "app.snippr.in" })).toBeNull();
  });
  it("an ordinary build never uses them", () => {
    expect(demoLocationMode({ devServer: false, demoBuild: false, hostname: "snippr-x.vercel.app" })).toBeNull();
  });
});

describe("isDemoFlagOn (tolerant of how dashboards store values, still an explicit yes)", () => {
  it.each([["true"], ["TRUE"], ["True"], [" true "], ['"true"'], ["'true'"]])("%j → on", (flag) => {
    expect(isDemoFlagOn(flag)).toBe(true);
    expect(demoSalonLocationsForBuild(flag, "preview")).toBe(true);
    expect(demoSalonLocationsForBuild(flag, "production")).toBe(false); // the Production guard still wins
  });
  it.each([[undefined], [""], ["1"], ["yes"], ["false"], ["on"], ["truee"]])("%j → off", (flag) => {
    expect(isDemoFlagOn(flag)).toBe(false);
  });
});

describe("describeDemoBuild (one line for the build log — no secrets)", () => {
  it.each([
    [undefined, "preview", false, 'OFF — VITE_DEMO_SALON_LOCATIONS is not set for this build (VERCEL_ENV=preview)'],
    ["yes", "preview", false, 'OFF — VITE_DEMO_SALON_LOCATIONS is not "true" for this build (VERCEL_ENV=preview)'],
    ["true", "production", false, "OFF — Vercel Production build (the flag is ignored in Production)"],
    ["true", "preview", true, "ON — VITE_DEMO_SALON_LOCATIONS=true (VERCEL_ENV=preview); never applied on production domains"],
    ["true", undefined, true, "ON — VITE_DEMO_SALON_LOCATIONS=true (VERCEL_ENV not set); never applied on production domains"],
  ])("flag %j, VERCEL_ENV %j → %s", (flag, vercelEnv, enabled, reason) => {
    expect(describeDemoBuild(flag, vercelEnv)).toEqual({ enabled, reason });
  });
});

describe("reportDemoLocations (runtime, once per page load)", () => {
  it("says how many listed salons use demo coordinates, once, and returns the rows unchanged", async () => {
    vi.resetModules();
    const { reportDemoLocations } = await import("@/lib/demoLocations");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const rows = [{ id: "a", locationDemo: { status: "landmark" } }, { id: "b" }, { id: "c", locationDemo: { status: "street" } }];
    expect(reportDemoLocations(rows)).toBe(rows);
    reportDemoLocations(rows);
    expect(info).toHaveBeenCalledTimes(1);
    expect(info.mock.calls[0][0]).toBe("[map] Demo salon locations are on: 2 of 3 salons use test coordinates (not real locations).");
    info.mockRestore();
  });
});

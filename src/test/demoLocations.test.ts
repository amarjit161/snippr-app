import { describe, expect, it } from "vitest";
import { demoLocationMode, demoSalonLocationsForBuild, isProductionHost } from "@/lib/demoLocations";

// When the demo salon coordinates may be used (src/lib/demoLocations.ts).

describe("demoSalonLocationsForBuild (the build-time decision used by vite.config.ts)", () => {
  it.each([
    ["true", "preview", true], // Vercel Preview with the flag
    ["true", undefined, true], // a non-Vercel demo/staging build with the flag
    ["true", "development", true],
    ["true", "production", false], // never a Vercel Production build, even with the flag
    [undefined, "preview", false], // no flag: an ordinary Preview build has no demo data
    [undefined, undefined, false],
    ["1", "preview", false], // only the exact value "true" opts in
    ["TRUE", "preview", false],
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

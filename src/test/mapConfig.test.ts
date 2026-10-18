import { afterEach, describe, expect, it, vi } from "vitest";

// Development uses VITE_CARTO_DEV_API_KEY, production builds VITE_CARTO_API_KEY,
// with no fallback between them. Fake values only.

const fresh = async () => {
  vi.resetModules();
  return import("@/lib/mapConfig");
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("CARTO key selection", () => {
  it("development selects the development key", async () => {
    const { getCartoTileUrl, cartoKeyVariable } = await fresh();
    const env = { DEV: true, VITE_CARTO_DEV_API_KEY: "dev-fake", VITE_CARTO_API_KEY: "prod-fake" };
    expect(cartoKeyVariable(env)).toBe("VITE_CARTO_DEV_API_KEY");
    expect(getCartoTileUrl(env)).toMatch(/\?key=dev-fake$/);
  });

  it("production selects the production key, never the development key", async () => {
    const { getCartoTileUrl, cartoKeyVariable } = await fresh();
    expect(cartoKeyVariable({ DEV: false })).toBe("VITE_CARTO_API_KEY");
    expect(getCartoTileUrl({ DEV: false, VITE_CARTO_DEV_API_KEY: "dev-fake", VITE_CARTO_API_KEY: "prod-fake" })).toMatch(
      /\?key=prod-fake$/,
    );
    // Only a dev key present → production has no key, rather than using it.
    expect(getCartoTileUrl({ DEV: false, VITE_CARTO_DEV_API_KEY: "dev-fake" })).toBeNull();
  });

  it("a missing development key fails clearly, without falling back to the production key", async () => {
    const { getCartoTileUrl } = await fresh();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(getCartoTileUrl({ DEV: true, VITE_CARTO_DEV_API_KEY: "  ", VITE_CARTO_API_KEY: "prod-fake" })).toBeNull();
    expect(error).toHaveBeenCalledTimes(1);
    const message = String(error.mock.calls[0][0]);
    expect(message).toContain("VITE_CARTO_DEV_API_KEY is not set");
    expect(message).toContain("restart the dev server");
    expect(message).not.toContain("prod-fake");
    // Reported once, not on every render.
    getCartoTileUrl({ DEV: true });
    expect(error).toHaveBeenCalledTimes(1);
  });

  it("a production build without its key (e.g. a Vercel environment without it) says which variable is missing, once", async () => {
    const { getCartoTileUrl } = await fresh();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // The development key alone never stands in for the production one.
    expect(getCartoTileUrl({ DEV: false, VITE_CARTO_DEV_API_KEY: "dev-fake" })).toBeNull();
    expect(error).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    const message = String(warn.mock.calls[0][0]);
    expect(message).toContain("VITE_CARTO_API_KEY was not set when this build was made");
    expect(message).toContain("Production or Preview");
    expect(message).not.toContain("dev-fake");
    getCartoTileUrl({ DEV: false });
    expect(warn).toHaveBeenCalledTimes(1); // once per page load
  });

  it("a build with its key says so once — the variable name, never the value", async () => {
    const { getCartoTileUrl } = await fresh();
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    getCartoTileUrl({ DEV: false, VITE_CARTO_API_KEY: "prod-secret-sss" });
    getCartoTileUrl({ DEV: false, VITE_CARTO_API_KEY: "prod-secret-sss" });
    expect(info).toHaveBeenCalledTimes(1);
    expect(String(info.mock.calls[0][0])).toBe("[map] VITE_CARTO_API_KEY is set for this build (value hidden).");
  });

  it("redactMapKey hides key values in URLs and messages (keys may contain any letters)", async () => {
    const { redactMapKey } = await fresh();
    expect(redactMapKey("https://basemaps.cartocdn.com/a/1/2/3.png?key=abc_sss-XYZ")).toBe(
      "https://basemaps.cartocdn.com/a/1/2/3.png?key=<hidden>",
    );
    expect(redactMapKey("GET ...?x=1&key=s3cr3ts&y=2 failed")).toBe("GET ...?x=1&key=<hidden>&y=2 failed");
    expect(redactMapKey("load 'https://t.invalid/z.png?KEY=Sss' (403)")).toBe("load 'https://t.invalid/z.png?KEY=<hidden>' (403)");
    expect(redactMapKey("nothing to hide")).toBe("nothing to hide");
  });

  it("by default reads the current mode's variable (Vitest runs in development mode)", async () => {
    vi.stubEnv("VITE_CARTO_DEV_API_KEY", "dev-fake");
    vi.stubEnv("VITE_CARTO_API_KEY", "prod-fake");
    const { getCartoTileUrl } = await fresh();
    expect(import.meta.env.DEV).toBe(true);
    expect(getCartoTileUrl()).toMatch(/\?key=dev-fake$/);
  });
});

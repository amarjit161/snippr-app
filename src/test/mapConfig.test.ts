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

  it("a missing production key returns null quietly (the map shows its notice)", async () => {
    const { getCartoTileUrl } = await fresh();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(getCartoTileUrl({ DEV: false })).toBeNull();
    expect(error).not.toHaveBeenCalled();
  });

  it("by default reads the current mode's variable (Vitest runs in development mode)", async () => {
    vi.stubEnv("VITE_CARTO_DEV_API_KEY", "dev-fake");
    vi.stubEnv("VITE_CARTO_API_KEY", "prod-fake");
    const { getCartoTileUrl } = await fresh();
    expect(import.meta.env.DEV).toBe(true);
    expect(getCartoTileUrl()).toMatch(/\?key=dev-fake$/);
  });
});

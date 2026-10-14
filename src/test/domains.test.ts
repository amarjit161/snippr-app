import { afterEach, describe, expect, it, vi } from "vitest";

type Domains = typeof import("@/lib/domains");

const loadDomains = async (env: Record<string, string | undefined>): Promise<Domains> => {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value ?? "");
  return import("@/lib/domains");
};

const at = (url: string) => {
  const u = new URL(url);
  return { origin: u.origin, host: u.host, pathname: u.pathname, search: u.search, hash: u.hash };
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("domain split disabled (VITE_APP_ORIGIN unset)", () => {
  it("treats every host as combined and never redirects", async () => {
    const d = await loadDomains({ VITE_APP_ORIGIN: undefined });
    expect(d.getHostRole(at("https://www.snippr.in/salons"))).toBe("combined");
    expect(d.getAppHostRedirect(at("https://www.snippr.in/q/ABC123"))).toBeNull();
    expect(d.getAppHostRedirect(at("https://www.snippr.in/#access_token=x&refresh_token=y&type=recovery"))).toBeNull();
  });
});

describe("domain split enabled", () => {
  const env = { VITE_APP_ORIGIN: "https://app.snippr.in", VITE_MARKETING_ORIGIN: "https://www.snippr.in" };

  it("identifies host roles", async () => {
    const d = await loadDomains(env);
    expect(d.getHostRole(at("https://www.snippr.in/"))).toBe("marketing");
    expect(d.getHostRole(at("https://snippr.in/"))).toBe("marketing");
    expect(d.getHostRole(at("https://app.snippr.in/salons"))).toBe("app");
    expect(d.getHostRole(at("https://snippr-git-branch.vercel.app/salons"))).toBe("combined");
    expect(d.getHostRole(at("http://localhost:5174/salons"))).toBe("combined");
  });

  it("keeps marketing pages on www", async () => {
    const d = await loadDomains(env);
    for (const path of ["/", "/how-it-works", "/careers", "/support", "/privacy", "/privacy/"]) {
      expect(d.getAppHostRedirect(at(`https://www.snippr.in${path}`))).toBeNull();
    }
  });

  it("forwards app routes with path, query and hash intact (printed QR codes keep working)", async () => {
    const d = await loadDomains(env);
    expect(d.getAppHostRedirect(at("https://www.snippr.in/q/ABC123"))).toBe("https://app.snippr.in/q/ABC123");
    expect(d.getAppHostRedirect(at("https://www.snippr.in/salon/59581580-0ade?ref=x"))).toBe("https://app.snippr.in/salon/59581580-0ade?ref=x");
    expect(d.getAppHostRedirect(at("https://www.snippr.in/owner-dashboard"))).toBe("https://app.snippr.in/owner-dashboard");
    expect(d.getAppHostRedirect(at("https://www.snippr.in/auth/callback?next=/onboarding#access_token=a&refresh_token=b")))
      .toBe("https://app.snippr.in/auth/callback?next=/onboarding#access_token=a&refresh_token=b");
    // Unknown paths go to the app, where Smart URL Recovery / 404 handle them.
    expect(d.getAppHostRedirect(at("https://www.snippr.in/salnos"))).toBe("https://app.snippr.in/salnos");
  });

  it("forwards auth links that fell back to the www root", async () => {
    const d = await loadDomains(env);
    expect(d.getAppHostRedirect(at("https://www.snippr.in/#access_token=a&refresh_token=b&type=recovery")))
      .toBe("https://app.snippr.in/auth/callback#access_token=a&refresh_token=b&type=recovery");
    expect(d.getAppHostRedirect(at("https://www.snippr.in/#error=access_denied&error_code=otp_expired")))
      .toBe("https://app.snippr.in/reset-password?expired=1");
    expect(d.getAppHostRedirect(at("https://www.snippr.in/#access_token=a&refresh_token=b&type=magiclink")))
      .toBe("https://app.snippr.in/#access_token=a&refresh_token=b&type=magiclink");
    expect(d.getAppHostRedirect(at("https://www.snippr.in/?utm_source=x"))).toBeNull();
  });

  it("never redirects on the app host itself", async () => {
    const d = await loadDomains(env);
    expect(d.getAppHostRedirect(at("https://app.snippr.in/salons"))).toBeNull();
    expect(d.getAppHostRedirect(at("https://app.snippr.in/"))).toBeNull();
  });
});

describe("resolveRootAuthTarget", () => {
  it("matches the previous homepage recovery handling", async () => {
    const d = await loadDomains({});
    expect(d.resolveRootAuthTarget("", "#error=access_denied")).toBe("/reset-password?expired=1");
    expect(d.resolveRootAuthTarget("?type=recovery&token_hash=t", "")).toBe("/auth/callback?type=recovery&token_hash=t");
    expect(d.resolveRootAuthTarget("", "#type=recovery")).toBeNull();
    expect(d.resolveRootAuthTarget("", "")).toBeNull();
  });
});

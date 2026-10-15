import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, createRoutesFromChildren, useLocation, useNavigate } from "react-router-dom";
import type { RouteObject } from "react-router-dom";
import OwnerResetPassword from "@/pages/OwnerResetPassword";

// Every Supabase entry point is a spy: the redirect must not touch any of them.
const supabaseSpies = vi.hoisted(() => ({
  onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  getSession: vi.fn(async () => ({ data: { session: null } })),
  setSession: vi.fn(),
  verifyOtp: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: supabaseSpies.onAuthStateChange,
      getSession: supabaseSpies.getSession,
      setSession: supabaseSpies.setSession,
      verifyOtp: supabaseSpies.verifyOtp,
      exchangeCodeForSession: supabaseSpies.exchangeCodeForSession,
      updateUser: supabaseSpies.updateUser,
      signOut: supabaseSpies.signOut,
    },
    from: supabaseSpies.from,
  },
}));

const TOKEN_HASH = "secret-token-hash-abc";
const ACCESS_TOKEN = "secret-access-token-def";

/** Stand-in for the shared reset page: shows exactly where the user landed. */
function ResetPasswordProbe() {
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();
  return (
    <div>
      <div data-testid="location">{`${pathname}${search}${hash}`}</div>
      <button onClick={() => navigate(-1)}>back</button>
    </div>
  );
}

const renderAt = (entries: string[], index = entries.length - 1) =>
  render(
    <MemoryRouter initialEntries={entries} initialIndex={index}>
      <Routes>
        <Route path="/owner-reset-password" element={<OwnerResetPassword />} />
        <Route path="/reset-password" element={<ResetPasswordProbe />} />
        <Route path="*" element={<div data-testid="other">{"other"}</div>} />
      </Routes>
    </MemoryRouter>,
  );

const landedOn = (expected: string) =>
  waitFor(() => expect(screen.getByTestId("location").textContent).toBe(expected));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => vi.restoreAllMocks());

describe("/owner-reset-password compatibility redirect", () => {
  it("redirects to /reset-password", async () => {
    renderAt(["/owner-reset-password"]);
    await landedOn("/reset-password");
  });

  it("preserves the query string, including recovery parameters", async () => {
    renderAt([`/owner-reset-password?email=owner%40example.invalid&token_hash=${TOKEN_HASH}&type=recovery`]);
    await landedOn(`/reset-password?email=owner%40example.invalid&token_hash=${TOKEN_HASH}&type=recovery`);
  });

  it.each([
    [`#access_token=${ACCESS_TOKEN}&refresh_token=r&type=recovery`],
    ["#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired"],
  ])("preserves the hash %s", async (hash) => {
    renderAt([`/owner-reset-password${hash}`]);
    await landedOn(`/reset-password${hash}`);
  });

  it("preserves query and hash together (e.g. a PKCE code plus hash)", async () => {
    renderAt(["/owner-reset-password?code=pkce-code&email=o%40example.invalid#section"]);
    await landedOn("/reset-password?code=pkce-code&email=o%40example.invalid#section");
  });

  it("cannot be pointed at an external destination", async () => {
    const url = `/owner-reset-password?next=${encodeURIComponent("https://evil.com")}&redirect_to=${encodeURIComponent("//evil.com")}&redirect=javascript:alert(1)`;
    renderAt([url]);
    // Always the same-origin /reset-password; the parameters are passed through, never followed.
    await waitFor(() => expect(screen.getByTestId("location").textContent?.startsWith("/reset-password?")).toBe(true));
    expect(screen.getByTestId("location").textContent).toBe(url.replace("/owner-reset-password", "/reset-password"));
  });

  it("replaces the history entry (Back skips it, so there is no redirect loop)", async () => {
    renderAt(["/start", "/owner-reset-password?email=o%40example.invalid"]);
    await landedOn("/reset-password?email=o%40example.invalid");
    fireEvent.click(screen.getByRole("button", { name: "back" }));
    await waitFor(() => expect(screen.getByTestId("other")).toBeInTheDocument());
    expect(screen.queryByTestId("location")).not.toBeInTheDocument();
  });

  it("does no Supabase verification and registers no auth listener", async () => {
    renderAt([`/owner-reset-password?token_hash=${TOKEN_HASH}&type=recovery#access_token=${ACCESS_TOKEN}&type=recovery`]);
    await waitFor(() => expect(screen.getByTestId("location")).toBeInTheDocument());
    for (const spy of Object.values(supabaseSpies)) expect(spy).not.toHaveBeenCalled();
  });

  it("does not log or store tokens", async () => {
    const consoleSpies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
    renderAt([`/owner-reset-password?email=owner%40example.invalid&token_hash=${TOKEN_HASH}&type=recovery#access_token=${ACCESS_TOKEN}&type=recovery`]);
    await waitFor(() => expect(screen.getByTestId("location")).toBeInTheDocument());
    const logged = JSON.stringify(consoleSpies.flatMap((s) => s.mock.calls));
    expect(logged).not.toContain(TOKEN_HASH);
    expect(logged).not.toContain(ACCESS_TOKEN);
    // The old page saved the email in localStorage; the redirect stores nothing.
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});

describe("app routing", () => {
  it("still registers /owner-reset-password alongside /reset-password", async () => {
    const { appRouteTree } = await import("@/App");
    const paths: string[] = [];
    const walk = (routes: RouteObject[]) =>
      routes.forEach((r) => {
        if (r.path) paths.push(r.path);
        if (r.children) walk(r.children);
      });
    walk(createRoutesFromChildren(appRouteTree));
    expect(paths).toContain("/owner-reset-password");
    expect(paths).toContain("/reset-password");
  });
});

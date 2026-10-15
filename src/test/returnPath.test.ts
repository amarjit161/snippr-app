import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_RETURN_PATH,
  RETURN_PATH_STORAGE_KEY,
  consumeStoredReturnPath,
  isAuthLoopPath,
  isSafeReturnPath,
  readStoredReturnPath,
  resolveReturnPath,
  sanitizeReturnPath,
} from "@/lib/returnPath";

describe("sanitizeReturnPath — valid destinations", () => {
  it.each([
    ["/salons", "/salons"],
    ["/bookings", "/bookings"],
    ["/booking/confirm", "/booking/confirm"],
    ["/booking/confirm?x=1#details", "/booking/confirm?x=1#details"],
    ["/salon/50a23609-e0f3-45d4-93f4-825d37993d2d?ref=share", "/salon/50a23609-e0f3-45d4-93f4-825d37993d2d?ref=share"],
    ["/q/cGSTVbQN", "/q/cGSTVbQN"],
    ["/my-profile#security", "/my-profile#security"],
    ["/", "/"],
    ["  /bookings  ", "/bookings"],
  ])("keeps %s", (input, expected) => {
    expect(sanitizeReturnPath(input)).toBe(expected);
    expect(isSafeReturnPath(input)).toBe(true);
  });

  it("normalises dot segments without leaving the site", () => {
    expect(sanitizeReturnPath("/booking/../bookings")).toBe("/bookings");
    expect(sanitizeReturnPath("/../../salons")).toBe("/salons");
  });
});

describe("sanitizeReturnPath — rejected values", () => {
  it.each([undefined, null, "", "   ", 42, {}, ["/bookings"]])("rejects missing/non-string %p", (input) => {
    expect(sanitizeReturnPath(input)).toBeNull();
  });

  it.each([
    "//evil.com",
    "//evil.com/bookings",
    "///evil.com",
    "/\\evil.com",
    "/\\/evil.com",
    "\\\\evil.com",
    "/bookings\\..\\..\\evil",
    "https://evil.com",
    "http://evil.com/bookings",
    "https://www.snippr.in/bookings",
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    " javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "bookings",
    "./bookings",
    "?next=/bookings",
    "#bookings",
    "/\t/evil.com",
    "/\n/evil.com",
    "/bookings\u0000",
  ])("rejects unsafe %p", (input) => {
    expect(sanitizeReturnPath(input)).toBeNull();
    expect(isSafeReturnPath(input)).toBe(false);
  });

  it.each([
    "/login",
    "/login?next=/bookings",
    "/LOGIN",
    "/login/",
    "/auth",
    "/auth#x",
    "/auth/",
    "/auth/callback",
    "/auth/callback?next=%2Fbookings#access_token=x",
    "/Auth/Callback",
    "/%6Cogin",
    "/%61uth/callback",
  ])("rejects auth-loop destination %p", (input) => {
    expect(sanitizeReturnPath(input)).toBeNull();
  });

  it("does not treat look-alike paths as auth pages", () => {
    expect(isAuthLoopPath("/authors")).toBe(false);
    expect(isAuthLoopPath("/login-help")).toBe(false);
    expect(sanitizeReturnPath("/owner-login")).toBe("/owner-login");
  });
});

describe("resolveReturnPath — fallback", () => {
  it("defaults to /salons", () => {
    expect(DEFAULT_RETURN_PATH).toBe("/salons");
    expect(resolveReturnPath(null)).toBe("/salons");
    expect(resolveReturnPath("")).toBe("/salons");
    expect(resolveReturnPath("//evil.com")).toBe("/salons");
    expect(resolveReturnPath("/auth/callback")).toBe("/salons");
  });

  it("returns the safe value when valid", () => {
    expect(resolveReturnPath("/booking/confirm?x=1#details")).toBe("/booking/confirm?x=1#details");
  });

  it("accepts a custom fallback", () => {
    expect(resolveReturnPath("https://evil.com", "/onboarding")).toBe("/onboarding");
  });

  it("is not influenced by the page's current origin", () => {
    // jsdom runs on http://localhost:3000; a same-origin absolute URL is still not a relative path.
    expect(resolveReturnPath(`${window.location.origin}/bookings`)).toBe("/salons");
  });
});

describe("stored redirectAfterLogin", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("uses the existing redirectAfterLogin key", () => {
    expect(RETURN_PATH_STORAGE_KEY).toBe("redirectAfterLogin");
  });

  it("readStoredReturnPath reads without clearing", () => {
    localStorage.setItem("redirectAfterLogin", "/booking/confirm?x=1#details");
    expect(readStoredReturnPath()).toBe("/booking/confirm?x=1#details");
    expect(localStorage.getItem("redirectAfterLogin")).toBe("/booking/confirm?x=1#details");
  });

  it("readStoredReturnPath returns null for missing or unsafe values", () => {
    expect(readStoredReturnPath()).toBeNull();
    localStorage.setItem("redirectAfterLogin", "//evil.com");
    expect(readStoredReturnPath()).toBeNull();
  });

  it("consumeStoredReturnPath returns the path and clears it", () => {
    localStorage.setItem("redirectAfterLogin", "/bookings");
    expect(consumeStoredReturnPath()).toBe("/bookings");
    expect(localStorage.getItem("redirectAfterLogin")).toBeNull();
    expect(consumeStoredReturnPath()).toBe("/salons");
  });

  it("consumeStoredReturnPath clears unsafe values and falls back", () => {
    localStorage.setItem("redirectAfterLogin", "javascript:alert(1)");
    expect(consumeStoredReturnPath()).toBe("/salons");
    expect(localStorage.getItem("redirectAfterLogin")).toBeNull();
  });

  it("consumeStoredReturnPath honours a custom fallback", () => {
    expect(consumeStoredReturnPath("/onboarding")).toBe("/onboarding");
  });

  it("survives storage that throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readStoredReturnPath()).toBeNull();
    expect(consumeStoredReturnPath()).toBe("/salons");
  });
});

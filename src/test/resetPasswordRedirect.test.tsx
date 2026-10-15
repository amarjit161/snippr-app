import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import ResetPassword from "@/pages/ResetPassword";

// Supabase mocked: no reset emails, no real password changes. `calls` records
// the order of auth/db calls so tests can assert the update happens first.
const mocks = vi.hoisted(() => ({
  calls: [] as string[],
  setSession: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  ownerLookup: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      setSession: mocks.setSession,
      updateUser: mocks.updateUser,
      signOut: mocks.signOut,
      verifyOtp: vi.fn(),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    from: (table: string) => ({
      select: () => ({
        eq: (column: string, value: string) => ({
          maybeSingle: () => mocks.ownerLookup(table, column, value),
        }),
      }),
    }),
  },
}));

vi.mock("sonner", () => ({ toast: { error: mocks.toastError, success: mocks.toastSuccess } }));

const USER_ID = "user-123";

function LocationProbe() {
  const { pathname } = useLocation();
  return <div data-testid="location">{pathname}</div>;
}

const renderRecoveryPage = () => {
  // A recovery link lands with tokens in the hash; the page verifies them via setSession.
  window.history.replaceState(null, "", "/reset-password#access_token=test-access&refresh_token=test-refresh&type=recovery");
  return render(
    <MemoryRouter initialEntries={["/reset-password"]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
};

const setNewPassword = async () => {
  await screen.findByText("Set new password");
  fireEvent.change(screen.getByPlaceholderText("Minimum 8 characters"), { target: { value: "new-password-123" } });
  fireEvent.change(screen.getByPlaceholderText("Re-enter password"), { target: { value: "new-password-123" } });
  fireEvent.click(screen.getByRole("button", { name: /update password/i }));
};

const landedOn = (path: string) => waitFor(() => expect(screen.getByTestId("location").textContent).toBe(path));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.calls.length = 0;
  mocks.setSession.mockResolvedValue({ data: {}, error: null });
  mocks.updateUser.mockImplementation(async () => {
    mocks.calls.push("updateUser");
    return { data: { user: { id: USER_ID } }, error: null };
  });
  mocks.signOut.mockImplementation(async () => {
    mocks.calls.push("signOut");
    return { error: null };
  });
});

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

describe("ResetPassword — destination after a successful update", () => {
  it("owner row found → /owner-login", async () => {
    mocks.ownerLookup.mockImplementation(async (table: string, column: string, value: string) => {
      mocks.calls.push(`lookup:${table}.${column}=${value}`);
      return { data: { id: USER_ID }, error: null };
    });
    renderRecoveryPage();
    await setNewPassword();
    await landedOn("/owner-login");
    expect(mocks.calls).toEqual(["updateUser", `lookup:owners.id=${USER_ID}`, "signOut"]);
  });

  it("no owner row → /login", async () => {
    mocks.ownerLookup.mockImplementation(async () => {
      mocks.calls.push("lookup");
      return { data: null, error: null };
    });
    renderRecoveryPage();
    await setNewPassword();
    await landedOn("/login");
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
  });

  it("owner lookup returns an error → /login", async () => {
    mocks.ownerLookup.mockResolvedValue({ data: null, error: { message: "permission denied" } });
    renderRecoveryPage();
    await setNewPassword();
    await landedOn("/login");
  });

  it("owner lookup throws → /login", async () => {
    mocks.ownerLookup.mockRejectedValue(new Error("network down"));
    renderRecoveryPage();
    await setNewPassword();
    await landedOn("/login");
  });

  it("no user id returned → /login without querying owners", async () => {
    mocks.updateUser.mockResolvedValue({ data: { user: null }, error: null });
    renderRecoveryPage();
    await setNewPassword();
    await landedOn("/login");
    expect(mocks.ownerLookup).not.toHaveBeenCalled();
  });

  it("does not trust user_metadata.role: an owner without it still goes to /owner-login", async () => {
    mocks.updateUser.mockResolvedValue({ data: { user: { id: USER_ID, user_metadata: {} } }, error: null });
    mocks.ownerLookup.mockResolvedValue({ data: { id: USER_ID }, error: null });
    renderRecoveryPage();
    await setNewPassword();
    await landedOn("/owner-login");
  });
});

describe("ResetPassword — failed update", () => {
  it("stays on the page, shows the error, never looks up owners or signs out", async () => {
    mocks.updateUser.mockImplementation(async () => {
      mocks.calls.push("updateUser");
      return { data: { user: null }, error: { message: "New password should be different from the old password." } };
    });
    renderRecoveryPage();
    await setNewPassword();
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("New password should be different from the old password."));
    expect(screen.getByText("Set new password")).toBeInTheDocument();
    expect(screen.queryByTestId("location")).not.toBeInTheDocument();
    expect(mocks.ownerLookup).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.calls).toEqual(["updateUser"]);
  });
});

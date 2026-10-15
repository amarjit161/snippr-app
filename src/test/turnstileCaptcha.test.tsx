import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// ---------------------------------------------------------------------------
// Fake Turnstile widget: captures the props the component passes and exposes a
// spy reset(), so tests can fire onError/onSuccess and count resets.
// ---------------------------------------------------------------------------
type WidgetProps = {
  siteKey: string;
  appearance?: string;
  options?: Record<string, unknown>;
  onSuccess?: (token: string) => void;
  onError?: (code: string) => void;
  onExpire?: () => void;
};
const widget = vi.hoisted(() => ({
  props: null as WidgetProps | null,
  reset: vi.fn(),
  response: "",
}));

vi.mock("@marsidev/react-turnstile", async () => {
  const React = await import("react");
  const Turnstile = React.forwardRef((props: WidgetProps, ref) => {
    widget.props = props;
    React.useImperativeHandle(ref, () => ({ reset: widget.reset, getResponse: () => widget.response }));
    return <div data-testid="turnstile-widget" />;
  });
  return { Turnstile };
});

// For the OwnerLogin integration checks.
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: null, session: null, profile: null, loading: false, profileLoading: false }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { signInWithPassword: vi.fn(), resetPasswordForEmail: vi.fn() },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
  },
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("gsap", () => {
  const chain = { to: () => chain, fromTo: () => chain, set: () => chain, kill: () => chain };
  return { default: { to: () => chain, fromTo: () => chain, set: () => chain, timeline: () => chain, context: () => ({ revert: () => {} }) } };
});

import TurnstileCaptcha, { type TurnstileCaptchaHandle } from "@/components/TurnstileCaptcha";
import OwnerLogin from "@/pages/OwnerLogin";

const TOKEN = "challenge-token-xyz";

const fireError = (code: string) => act(() => widget.props!.onError!(code));
const fireSuccess = (token = TOKEN) => act(() => widget.props!.onSuccess!(token));
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

const renderCaptcha = () => {
  const onTokenChange = vi.fn();
  const ref = createRef<TurnstileCaptchaHandle>();
  const view = render(<TurnstileCaptcha ref={ref} onTokenChange={onTokenChange} theme="dark" />);
  return { onTokenChange, ref, view };
};

beforeEach(() => {
  vi.clearAllMocks();
  widget.props = null;
  widget.response = "";
  vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "test-site-key");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("widget configuration (authorized hostnames unchanged)", () => {
  it("renders the widget with the site key, interaction-only appearance, and its own retries off", () => {
    renderCaptcha();
    expect(widget.props?.siteKey).toBe("test-site-key");
    expect(widget.props?.appearance).toBe("interaction-only");
    expect(widget.props?.options).toMatchObject({ theme: "dark", size: "flexible", language: "auto", retry: "never" });
  });

  it("a normal successful challenge supplies the token, with no error shown", () => {
    const { onTokenChange } = renderCaptcha();
    fireSuccess();
    expect(onTokenChange).toHaveBeenLastCalledWith(TOKEN);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("permanent / configuration errors", () => {
  it.each(["110100", "110110", "110200", "200100", "400020", "400021", "400070"])(
    "%s: clear message + Try again, and no automatic reset loop",
    (code) => {
      vi.useFakeTimers();
      const { onTokenChange } = renderCaptcha();
      fireError(code);
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent("isn't available on this site right now");
      expect(alert).toHaveTextContent(`(Error ${code})`);
      expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
      expect(onTokenChange).toHaveBeenLastCalledWith(null);
      advance(60_000);
      expect(widget.reset).not.toHaveBeenCalled();
    },
  );
});

describe("temporary errors", () => {
  it.each(["600010", "300030", "110600", "200500", "999999"])(
    "%s: bounded automatic retries, then a message",
    (code) => {
      vi.useFakeTimers();
      renderCaptcha();

      fireError(code);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      advance(1999);
      expect(widget.reset).toHaveBeenCalledTimes(0);
      advance(1);
      expect(widget.reset).toHaveBeenCalledTimes(1);

      fireError(code);
      advance(2000);
      expect(widget.reset).toHaveBeenCalledTimes(2);

      fireError(code); // budget used up
      expect(screen.getByRole("alert")).toHaveTextContent("couldn't be completed");
      expect(screen.getByRole("alert")).toHaveTextContent(`(Error ${code})`);
      advance(60_000);
      expect(widget.reset).toHaveBeenCalledTimes(2);
    },
  );

  it("rapid repeated errors never stack more than one pending retry", () => {
    vi.useFakeTimers();
    renderCaptcha();
    fireError("600010");
    fireError("600010"); // replaces the pending retry instead of adding one
    advance(2000);
    expect(widget.reset).toHaveBeenCalledTimes(1);
  });
});

describe("Try again", () => {
  it("resets the widget exactly once and clears the message", () => {
    vi.useFakeTimers();
    const { onTokenChange } = renderCaptcha();
    fireError("110200");
    onTokenChange.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(widget.reset).toHaveBeenCalledTimes(1);
    expect(onTokenChange).toHaveBeenCalledWith(null);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    advance(60_000);
    expect(widget.reset).toHaveBeenCalledTimes(1);
  });

  it("restores the automatic-retry budget after exhaustion", () => {
    vi.useFakeTimers();
    renderCaptcha();
    for (let i = 0; i < 3; i++) {
      fireError("600010");
      advance(2000);
    }
    expect(widget.reset).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(widget.reset).toHaveBeenCalledTimes(3);
    fireError("600010");
    advance(2000);
    expect(widget.reset).toHaveBeenCalledTimes(4); // retrying again, not stuck
  });

  it("the page's reset() (used after a failed sign-in) also clears the message", () => {
    const { ref } = renderCaptcha();
    fireError("110200");
    act(() => ref.current!.reset());
    expect(widget.reset).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("success after a failure", () => {
  it("after an automatic retry: clears the error state and supplies the token", () => {
    vi.useFakeTimers();
    const { onTokenChange } = renderCaptcha();
    fireError("600010");
    advance(2000);
    fireSuccess();
    expect(onTokenChange).toHaveBeenLastCalledWith(TOKEN);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    // Budget was reset by the success: a later failure retries again.
    fireError("600010");
    fireError("600010");
    fireError("600010");
    advance(2000);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("after Try again: clears the message and supplies the token", () => {
    const { onTokenChange } = renderCaptcha();
    fireError("110200");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    fireSuccess();
    expect(onTokenChange).toHaveBeenLastCalledWith(TOKEN);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("a success cancels a pending automatic retry", () => {
    vi.useFakeTimers();
    renderCaptcha();
    fireError("600010");
    fireSuccess();
    advance(5000);
    expect(widget.reset).not.toHaveBeenCalled();
  });
});

describe("unmount", () => {
  it("a scheduled retry cannot fire after unmount", () => {
    vi.useFakeTimers();
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { view } = renderCaptcha();
    fireError("600010");
    view.unmount();
    advance(10_000);
    expect(widget.reset).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});

describe("nothing sensitive is logged", () => {
  it("never logs the challenge token or the site key", () => {
    vi.useFakeTimers();
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    renderCaptcha();
    fireError("600010");
    advance(2000);
    fireSuccess();
    fireError("110200");
    const logged = JSON.stringify(spies.flatMap((s) => s.mock.calls));
    expect(logged).not.toContain(TOKEN);
    expect(logged).not.toContain("test-site-key");
    spies.forEach((s) => s.mockRestore());
  });
});

describe("OwnerLogin: the sign-in button needs a valid token", () => {
  const renderOwnerLogin = () =>
    render(
      <MemoryRouter>
        <OwnerLogin />
      </MemoryRouter>,
    );
  const loginButton = () => screen.getByRole("button", { name: /^login$/i });

  it("disabled with no token, enabled after success, disabled again after an error", () => {
    renderOwnerLogin();
    expect(loginButton()).toBeDisabled();
    fireSuccess();
    expect(loginButton()).toBeEnabled();
    fireError("110200");
    expect(loginButton()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("stays disabled through automatic retries until a challenge succeeds", () => {
    vi.useFakeTimers();
    renderOwnerLogin();
    fireError("600010");
    advance(2000);
    expect(loginButton()).toBeDisabled();
    fireSuccess();
    expect(loginButton()).toBeEnabled();
  });
});

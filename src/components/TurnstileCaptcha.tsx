import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { Turnstile, type TurnstileInstance, type TurnstileTheme } from '@marsidev/react-turnstile';

interface TurnstileCaptchaProps {
  onTokenChange: (token: string | null) => void;
  className?: string;
  theme?: TurnstileTheme;
}

export interface TurnstileCaptchaHandle {
  getResponse: () => string;
  reset: () => void;
}

// Cloudflare client-side error codes documented as NOT retryable — configuration
// problems (e.g. 110200 "Domain not authorized") that resetting can never fix.
// https://developers.cloudflare.com/turnstile/troubleshooting/client-side-errors/error-codes/
const NON_RETRYABLE_ERROR_CODES = new Set(["110100", "110110", "110200", "200100", "400020", "400021", "400070"]);

// Everything else (documented retryable codes such as 110600, 200500, 300*, 600*,
// and any unknown code) gets a bounded number of automatic retries.
const MAX_AUTO_RETRIES = 2;
const AUTO_RETRY_DELAY_MS = 2000;

type CaptchaError = { code: string; retryable: boolean };

const TurnstileCaptcha = forwardRef<TurnstileCaptchaHandle, TurnstileCaptchaProps>(function TurnstileCaptcha(
  { onTokenChange, className = "", theme = "light" },
  ref
) {
  const turnstileRef = useRef<TurnstileInstance | undefined>(undefined);
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
  const [captchaError, setCaptchaError] = useState<CaptchaError | null>(null);
  const autoRetriesRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelScheduledRetry = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  // No timer may fire (and reset/set state) after unmount.
  useEffect(() => cancelScheduledRetry, [cancelScheduledRetry]);

  /** One explicit reset: clears the error and the retry budget, then re-runs the challenge. */
  const restartChallenge = useCallback(() => {
    cancelScheduledRetry();
    autoRetriesRef.current = 0;
    setCaptchaError(null);
    onTokenChange(null);
    turnstileRef.current?.reset();
  }, [cancelScheduledRetry, onTokenChange]);

  // Expose reset and getResponse methods
  if (ref && typeof ref === 'object' && 'current' in ref) {
    ref.current = {
      getResponse: () => {
        return turnstileRef.current?.getResponse() || "";
      },
      reset: restartChallenge,
    };
  }

  const handleError = (code: string) => {
    onTokenChange(null);
    cancelScheduledRetry();
    const retryable = !NON_RETRYABLE_ERROR_CODES.has(code);
    if (retryable && autoRetriesRef.current < MAX_AUTO_RETRIES) {
      autoRetriesRef.current += 1;
      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = null;
        turnstileRef.current?.reset();
      }, AUTO_RETRY_DELAY_MS);
      return;
    }
    // Configuration error, or retries used up: stop and let the user decide.
    setCaptchaError({ code, retryable });
  };

  if (!siteKey) {
    console.error("VITE_TURNSTILE_SITE_KEY is not configured");
    return (
      <div className={className} style={{ width: "100%", maxWidth: "100%" }} role="alert">
        <div className="rounded-lg border border-white/30 bg-white/10 px-4 py-3 text-center text-xs text-white/80">
          Verification is temporarily unavailable, so booking is paused here for safety. Please try again shortly or contact support.
        </div>
      </div>
    );
  }

  return (
    <div className={className} style={{ width: "100%", maxWidth: "100%", overflow: "hidden" }}>
      <Turnstile
        ref={turnstileRef}
        siteKey={siteKey}
        appearance="interaction-only"
        options={{
          theme,
          size: "flexible",
          language: "auto",
          // Retries are handled above (bounded, and never for configuration
          // errors), so the widget must not also retry on its own.
          retry: "never",
        }}
        onSuccess={(token) => {
          cancelScheduledRetry();
          autoRetriesRef.current = 0;
          setCaptchaError(null);
          onTokenChange(token);
        }}
        onError={handleError}
        onExpire={() => {
          onTokenChange(null);
          turnstileRef.current?.reset();
        }}
        style={{ width: "100%" }}
      />
      {captchaError && (
        <div role="alert" className="mt-2 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          <p>
            {captchaError.retryable
              ? "The security check couldn't be completed."
              : "The security check isn't available on this site right now."}{" "}
            <span className="text-red-200/70">(Error {captchaError.code})</span>
          </p>
          <button
            type="button"
            onClick={restartChallenge}
            className="mt-1.5 font-semibold underline underline-offset-2 hover:text-white"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
});

TurnstileCaptcha.displayName = "TurnstileCaptcha";

export default TurnstileCaptcha;

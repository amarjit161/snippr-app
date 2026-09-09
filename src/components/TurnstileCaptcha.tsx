import { forwardRef, useRef } from "react";
import { Turnstile } from '@marsidev/react-turnstile';

type TurnstileTheme = "light" | "dark" | "auto";

interface TurnstileCaptchaProps {
  onTokenChange: (token: string | null) => void;
  className?: string;
  theme?: TurnstileTheme;
}

export interface TurnstileCaptchaHandle {
  getResponse: () => string;
  reset: () => void;
}

const TurnstileCaptcha = forwardRef<TurnstileCaptchaHandle, TurnstileCaptchaProps>(function TurnstileCaptcha(
  { onTokenChange, className = "", theme = "light" },
  ref
) {
  const turnstileRef = useRef<any>(null);
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

  // Expose reset and getResponse methods
  if (ref && typeof ref === 'object' && 'current' in ref) {
    ref.current = {
      getResponse: () => {
        return turnstileRef.current?.getResponse() || "";
      },
      reset: () => {
        turnstileRef.current?.reset();
        onTokenChange(null);
      },
    };
  }

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
          theme: theme as any,
          size: "flexible",
          language: "auto",
        }}
        onSuccess={(token) => onTokenChange(token)}
        onError={() => {
          onTokenChange(null);
          turnstileRef.current?.reset();
        }}
        onExpire={() => {
          onTokenChange(null);
          turnstileRef.current?.reset();
        }}
        style={{ width: "100%" }}
      />
    </div>
  );
});

TurnstileCaptcha.displayName = "TurnstileCaptcha";

export default TurnstileCaptcha;

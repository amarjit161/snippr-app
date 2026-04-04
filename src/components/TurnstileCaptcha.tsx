import { useEffect, useMemo, useRef, useState } from "react";

type TurnstileTheme = "light" | "dark" | "auto";

type TurnstileRenderOptions = {
  sitekey: string;
  theme?: TurnstileTheme;
  callback: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: () => void;
};

type TurnstileWidgetApi = {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  reset: (widgetId?: string) => void;
  remove?: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileWidgetApi;
  }
}

const TURNSTILE_SCRIPT_ID = "snippr-turnstile-script";
const TURNSTILE_SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let scriptPromise: Promise<void> | null = null;

const loadTurnstileScript = () => {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (window.turnstile) {
    return Promise.resolve();
  }

  if (scriptPromise) {
    return scriptPromise;
  }

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null;

    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Turnstile script")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = TURNSTILE_SCRIPT_ID;
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Turnstile script"));
    document.head.appendChild(script);
  }).finally(() => {
    scriptPromise = null;
  });

  return scriptPromise;
};

interface TurnstileCaptchaProps {
  onTokenChange: (token: string | null) => void;
  className?: string;
  theme?: TurnstileTheme;
}

export default function TurnstileCaptcha({ onTokenChange, className, theme = "light" }: TurnstileCaptchaProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

  const wrapperClassName = useMemo(
    () => className || "min-h-[82px] w-full overflow-hidden",
    [className]
  );

  useEffect(() => {
    onTokenChange(null);
  }, [onTokenChange]);

  useEffect(() => {
    let cancelled = false;

    const renderWidget = async () => {
      if (!siteKey || !containerRef.current) return;

      try {
        await loadTurnstileScript();
      } catch (error) {
        console.error("Turnstile script load failed", error);
        return;
      }

      if (cancelled || !containerRef.current || !window.turnstile) return;

      containerRef.current.innerHTML = "";

      const widgetId = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme,
        callback: (token: string) => onTokenChange(token),
        "expired-callback": () => onTokenChange(null),
        "error-callback": () => onTokenChange(null),
      });

      widgetIdRef.current = widgetId;
      setIsReady(true);
    };

    renderWidget();

    return () => {
      cancelled = true;

      if (widgetIdRef.current && window.turnstile) {
        if (window.turnstile.remove) {
          window.turnstile.remove(widgetIdRef.current);
        } else {
          window.turnstile.reset(widgetIdRef.current);
        }
      }

      widgetIdRef.current = null;
    };
  }, [onTokenChange, siteKey, theme]);

  if (!siteKey) {
    return (
      <div className={wrapperClassName}>
        <p className="text-xs text-muted-foreground">Captcha key is not configured.</p>
      </div>
    );
  }

  return (
    <div className={wrapperClassName} aria-live="polite">
      <div ref={containerRef} />
      {!isReady ? <p className="mt-2 text-xs text-muted-foreground">Loading verification...</p> : null}
    </div>
  );
}
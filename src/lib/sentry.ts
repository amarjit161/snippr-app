import * as Sentry from "@sentry/browser";

export function initSentry(dsn?: string) {
  if (!dsn) return;
  try {
    Sentry.init({ dsn, tracesSampleRate: 0.1 });
  } catch (err) {
    console.warn("Sentry init failed", err);
  }
}

export function captureException(err: any, ctx?: any) {
  try {
    Sentry.captureException(err, { extra: ctx });
  } catch (e) {
    // noop
  }
}

export default { initSentry, captureException };

/**
 * Simple feature flag helper. Supports runtime boolean flags via
 * - environment variables (build-time) `import.meta.env.VITE_FLAG_X`
 * - localStorage toggle for quick testing
 *
 * For production use, integrate with a feature flag service (LaunchDarkly, GrowthBook).
 */

export function isFeatureEnabled(key: string) {
  try {
    const envKey = (import.meta.env as any)[`VITE_FLAG_${key.toUpperCase()}`];
    if (typeof envKey !== "undefined") return String(envKey) === "true";
  } catch (err) {
    // ignore
  }

  try {
    const local = localStorage.getItem(`feature:${key}`);
    if (local !== null) return local === "true";
  } catch (err) {
    // ignore
  }

  return false;
}

export function setFeatureLocal(key: string, enabled: boolean) {
  try { localStorage.setItem(`feature:${key}`, enabled ? "true" : "false"); } catch (err) {}
}

export default { isFeatureEnabled, setFeatureLocal };

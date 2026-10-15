/**
 * Full page navigation to a same-origin path (replaces the current history
 * entry). Unlike router navigation it re-initialises the app — and with it all
 * auth state — from storage, so the next page can't act on stale in-memory state.
 * Kept in its own module so it can be mocked in tests (jsdom can't navigate).
 */
export function hardNavigate(path: string): void {
  window.location.replace(path);
}

/** Full page navigation to an absolute URL (e.g. the marketing site), keeping the history entry. */
export function openUrl(url: string): void {
  window.location.assign(url);
}

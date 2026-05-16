export async function captureEdgeError(err: unknown, context: Record<string, unknown> = {}) {
  // Minimal structured logging fallback. If Sentry DSN is configured later,
  // wire the HTTP ingest call here to avoid touching all functions.
  console.error("EDGE_ERROR", {
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
    context,
  });
}

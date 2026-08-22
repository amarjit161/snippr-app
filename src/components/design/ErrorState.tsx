interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  isDark?: boolean;
  compact?: boolean;
}

export function ErrorState({
  message = "Something went wrong",
  onRetry,
  isDark = false,
  compact = false,
}: ErrorStateProps) {
  return (
    <div style={{ textAlign: "center", padding: compact ? "24px 16px" : "48px 24px" }}>
      {!compact && <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>}
      <div className="font-display" style={{
        fontWeight: 700,
        fontSize: compact ? 14 : 18,
        color: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.55)",
        marginBottom: onRetry ? 12 : 0,
      }}>
        {message}
      </div>
      {onRetry && (
        <button onClick={onRetry} className="bg-primary font-sans" style={{
          padding: "9px 22px", borderRadius: 12, color: "#fff",
          fontWeight: 600, fontSize: 13, border: "none", cursor: "pointer",
        }}>
          Try again
        </button>
      )}
    </div>
  );
}

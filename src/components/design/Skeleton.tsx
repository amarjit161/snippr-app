const SHIMMER_CSS = `
@keyframes skeletonShimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}`;

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  isDark?: boolean;
}

export function Skeleton({ width = "100%", height = 16, borderRadius = 8, isDark = false }: SkeletonProps) {
  return (
    <>
      <style>{SHIMMER_CSS}</style>
      <div style={{
        width,
        height,
        borderRadius,
        background: isDark
          ? "linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.04) 75%)"
          : "linear-gradient(90deg, rgba(0,0,0,0.04) 25%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.04) 75%)",
        backgroundSize: "200% 100%",
        animation: "skeletonShimmer 1.6s ease-in-out infinite",
        flexShrink: 0,
      }} />
    </>
  );
}

export function SalonCardSkeleton({ isDark = false }: { isDark?: boolean }) {
  const bdr = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";
  const bg  = isDark ? "rgba(255,255,255,0.03)" : "#fff";
  return (
    <>
      <style>{SHIMMER_CSS}</style>
      <div style={{ borderRadius: 20, overflow: "hidden", border: `1px solid ${bdr}`, background: bg }}>
        <div style={{
          height: 88,
          background: isDark
            ? "linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)"
            : "linear-gradient(90deg, rgba(0,0,0,0.04) 25%, rgba(0,0,0,0.08) 50%, rgba(0,0,0,0.04) 75%)",
          backgroundSize: "200% 100%",
          animation: "skeletonShimmer 1.6s ease-in-out infinite",
        }} />
        <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
          <Skeleton width="58%" height={15} isDark={isDark} />
          <Skeleton width="38%" height={11} isDark={isDark} />
          <Skeleton width="75%" height={11} isDark={isDark} />
        </div>
      </div>
    </>
  );
}

export function QueueItemSkeleton({ isDark = false }: { isDark?: boolean }) {
  const bdr = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";
  const bg  = isDark ? "rgba(255,255,255,0.02)" : "#fff";
  return (
    <div style={{ borderRadius: 16, padding: "14px 16px", border: `1px solid ${bdr}`, background: bg,
      display: "flex", alignItems: "center", gap: 12 }}>
      <Skeleton width={28} height={28} borderRadius={99} isDark={isDark} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        <Skeleton width="50%" height={13} isDark={isDark} />
        <Skeleton width="35%" height={11} isDark={isDark} />
      </div>
      <Skeleton width={60} height={13} isDark={isDark} />
    </div>
  );
}

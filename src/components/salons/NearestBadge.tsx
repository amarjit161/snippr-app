/**
 * "Nearest": the salon closest to the customer's device position, by calculated
 * straight-line distance (lib/salonDiscovery nearestSalon). With a demo/test
 * coordinate it says so, so the ranking is never taken as real.
 */
export default function NearestBadge({ demo = false }: { demo?: boolean }) {
  return (
    <span
      data-testid="nearest-badge"
      title={demo ? "Closest by demo (not verified) location" : "Closest to you in a straight line"}
      className="inline-flex items-center rounded-md bg-violet-100 px-1.5 py-0.5 text-[11px] font-semibold text-violet-800"
    >
      {demo ? "Nearest (demo location)" : "Nearest"}
    </span>
  );
}

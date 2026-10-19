/**
 * Compact preview of the salon selected on the map: name, full address, open
 * status and live wait, starting price and distance when known, and one action.
 * Uses the same helpers as the salon cards, so nothing is shown that the cards
 * wouldn't show (no invented ratings, waits or distances).
 */
import { X } from "lucide-react";
import { formatStartingPrice, getWaitBadge, isWithinOperatingHours } from "@/lib/salonDiscovery";
import { distanceDescription, formatDistance } from "@/lib/salonLocation";
import NearestBadge from "@/components/salons/NearestBadge";

export interface SalonMapPreviewSalon {
  id: string;
  name: string;
  address?: string | null;
  location?: string | null;
  open_time: string | null;
  close_time: string | null;
  is_manual_closed: boolean | null;
  waitTime: number | null;
  startingPrice?: number | null;
  distance?: number | null;
  distanceApproximate?: boolean;
  /** Set for demo/test coordinates (lib/demoLocations.ts): labelled so it isn't taken as real. */
  locationDemo?: unknown;
  /** The closest salon to the customer (by calculated straight-line distance). */
  isNearest?: boolean;
}

interface SalonMapPreviewProps {
  salon: SalonMapPreviewSalon;
  onOpen: () => void;
  onClose: () => void;
}

export default function SalonMapPreview({ salon, onOpen, onClose }: SalonMapPreviewProps) {
  const isOpen = !salon.is_manual_closed && isWithinOperatingHours(salon.open_time, salon.close_time);
  const wait = getWaitBadge(salon.waitTime, isOpen);
  const waitText = wait.tone === "now" ? "No wait" : wait.tone === "unknown" ? "Wait unknown" : `${wait.label} wait`;
  const price = formatStartingPrice(salon.startingPrice);
  const distance = formatDistance(salon.distance, !!salon.distanceApproximate);
  const address = salon.address?.trim() || salon.location?.trim() || null;

  return (
    <section
      aria-label={`Selected salon: ${salon.name}`}
      data-testid="map-preview"
      // Same card surface as the salon list, lifted off the map with a soft, faintly purple shadow
      // and a thin brand accent along the top.
      className="relative overflow-hidden rounded-2xl border border-border bg-card p-3.5 pt-4 text-foreground shadow-[0_2px_4px_rgba(17,24,39,0.06),0_16px_32px_-12px_rgba(76,29,149,0.35)] before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-gradient-to-r before:from-primary before:to-violet-400"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="line-clamp-2 font-display text-base font-semibold leading-snug tracking-[-0.01em]">{salon.name}</h3>
        <button
          type="button"
          aria-label="Close preview"
          onClick={onClose}
          className="-mr-1.5 -mt-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {address ? <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground" title={address}>{address}</p> : null}
      {salon.locationDemo || salon.isNearest ? (
        <p className="mt-1.5 flex flex-wrap gap-1.5">
          {salon.isNearest ? <NearestBadge demo={!!salon.locationDemo} /> : null}
          {salon.locationDemo ? (
            <span className="inline-flex rounded-md bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-900">
              Demo location — not verified
            </span>
          ) : null}
        </p>
      ) : null}
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className={`flex items-center gap-1.5 font-semibold ${isOpen ? "text-emerald-700" : "text-muted-foreground"}`}>
          <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${isOpen ? "bg-success" : "bg-muted-foreground/50"}`} />
          {isOpen ? "Open now" : "Closed"}
        </span>
        {isOpen ? (
          <span className="font-mono text-foreground/80">
            <span aria-hidden="true">{waitText}</span>
            <span className="sr-only">{wait.description}</span>
          </span>
        ) : null}
        {distance ? (
          <span className="font-mono text-muted-foreground" title={distanceDescription(distance, !!salon.distanceApproximate)}>
            <span aria-hidden="true">{distance}</span>
            <span className="sr-only">{distanceDescription(distance, !!salon.distanceApproximate)}</span>
          </span>
        ) : null}
      </p>
      <div className="mt-3 flex items-center justify-between gap-3">
        {price ? <p className="whitespace-nowrap font-mono text-sm font-semibold">{price}</p> : <span />}
        <button
          type="button"
          onClick={onOpen}
          className="min-h-10 shrink-0 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {isOpen ? "Book a Snipp" : "View salon"}
        </button>
      </div>
    </section>
  );
}

import React, { useState } from "react";
import { Clock, Heart, LocateFixed, MapPin, Star, Users } from "lucide-react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { cardFloat } from "@/lib/motion";
// Shared with SalonPage and QuickBooking, so every page agrees on open/closed.
import { formatStartingPrice, getWaitBadge, isWithinOperatingHours, type WaitColor } from "@/lib/salonDiscovery";
import { formatDistance, type LocationQuality } from "@/lib/salonLocation";

const WAIT_DOT_CLASS: Record<WaitColor, string> = {
  green: "bg-success",
  amber: "bg-warning",
  red: "bg-destructive",
  muted: "bg-white/60",
};

// The row card's badge sits on a light chip rather than over a photo.
const ROW_WAIT_DOT_CLASS: Record<WaitColor, string> = { ...WAIT_DOT_CLASS, muted: "bg-muted-foreground/60" };

import salon1 from "@/assets/salon-1.jpg";
import salon2 from "@/assets/salon-2.jpg";
import salon3 from "@/assets/salon-3.jpg";
import salon4 from "@/assets/salon-4.jpg";

const salonImages: Record<string, string> = {
  "/salon-1": salon1,
  "/salon-2": salon2,
  "/salon-3": salon3,
  "/salon-4": salon4,
};

const getSalonImageSrc = (imageUrl: string | null) => {
  if (!imageUrl) {
    return "/default-salon.jpg";
  }

  if (salonImages[imageUrl]) {
    return salonImages[imageUrl];
  }

  if (imageUrl.startsWith("http") || imageUrl.startsWith("/")) {
    return imageUrl;
  }

  const { data } = supabase.storage.from("salon-images").getPublicUrl(imageUrl);
  return data.publicUrl || "/default-salon.jpg";
};

interface SalonCardProps {
  // `rating` is optional: no current data source provides it (see the /salons audit).
  // `startingPrice` is the lowest valid service price (getStartingPrices); absent → no label.
  salon: Tables<"salons"> & {
    queueCount: number;
    waitTime: number;
    distance?: number;
    rating?: number | null;
    startingPrice?: number | null;
    /** Real service categories (from service names), e.g. ["Haircut", "Spa"]. */
    serviceLabels?: string[];
    /** Distance is approximate (coarse device reading or approximate salon location). */
    distanceApproximate?: boolean;
    /** How trustworthy the salon position is (row layout labels it). */
    locationQuality?: LocationQuality;
    /** Show "Location unavailable" for salons without coordinates (when distances are expected). */
    flagMissingLocation?: boolean;
  };
  index: number;
  onSelect: (salon: Tables<"salons">) => void;
  isFavorited?: boolean;
  onToggleFavorite?: (salon: Tables<"salons">) => void;
  /** "tile" (default: image on top, used by Favorites) or "row" (compact, image left: /salons). */
  layout?: "tile" | "row";
  /** Row layout in the map view: a labelled button that selects this salon on the map. */
  onShowOnMap?: () => void;
  /** This salon is the one selected on the map. */
  shownOnMap?: boolean;
}

const SalonCard = ({
  salon,
  index,
  onSelect,
  isFavorited,
  onToggleFavorite,
  layout = "tile",
  onShowOnMap,
  shownOnMap,
}: SalonCardProps) => {
  // A salon photo that fails to load falls back to the default image (row layout).
  const [photoFailed, setPhotoFailed] = useState(false);
  // Logic: If manually closed, always show closed. Otherwise check operating hours.
  const isManuallyClosed = salon.is_manual_closed;
  const isWithinHours = isWithinOperatingHours(salon.open_time, salon.close_time);
  const isOpen = !isManuallyClosed && isWithinHours;
  // A genuine rating only (a finite number above zero); otherwise nothing is shown.
  const rating = typeof salon.rating === "number" && Number.isFinite(salon.rating) && salon.rating > 0 ? salon.rating : null;
  // "Free" for ₹0, "From ₹…" otherwise, null (nothing shown) without a valid price.
  const startingPriceLabel = formatStartingPrice(salon.startingPrice);
  // Queue wait: an unknown wait stays unknown (no invented minutes).
  const waitBadge = getWaitBadge(salon.waitTime, isOpen);
  const waitText =
    waitBadge.tone === "now" ? "No wait" : waitBadge.tone === "unknown" ? "Wait unknown" : `${waitBadge.label} wait`;

  if (index === 0) {
    const now = new Date();
    const currentTimeNum = now.getHours() * 100 + now.getMinutes();
    console.log("SALON_CARD_LOGIC", {
      salonName: salon.name,
      isManuallyClosed,
      openTime: salon.open_time,
      closeTime: salon.close_time,
      isWithinHours,
      currentTime: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`,
      currentTimeNum,
      isOpen,
    });
  }

  if (layout === "row") {
    // No uploaded photo: the app's default image is shown, labelled the way the
    // landing page labels stand-in photos, so it never passes for the salon itself.
    const representativePhoto = !salon.image_url || photoFailed;
    const priceValue = startingPriceLabel?.startsWith("From ") ? startingPriceLabel.slice(5) : startingPriceLabel;
    return (
      <motion.div
        custom={index}
        initial="hidden"
        animate="visible"
        variants={cardFloat}
        className="group flex h-full cursor-pointer overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-primary/40"
        onClick={() => onSelect(salon)}
      >
        <div className="relative w-24 shrink-0 self-stretch overflow-hidden bg-muted sm:w-36 md:w-28 xl:w-36">
          <img
            src={photoFailed ? "/default-salon.jpg" : getSalonImageSrc(salon.image_url)}
            onError={() => {
              if (salon.image_url) setPhotoFailed(true);
            }}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
          {representativePhoto ? (
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-black/0 px-1 pb-1.5 pt-4 text-center font-mono text-[8px] uppercase leading-tight tracking-[0.08em] text-white/85">
              Representative photo
            </span>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-1 flex-col p-3.5 sm:p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 font-display text-[17px] font-semibold leading-snug tracking-[-0.01em] text-foreground">
              {salon?.name ?? "Unknown Salon"}
            </h3>
            <div className="-mr-2 -mt-2 flex shrink-0">
              {onShowOnMap ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onShowOnMap();
                  }}
                  aria-label={`Show ${salon?.name ?? "salon"} on the map`}
                  aria-pressed={!!shownOnMap}
                  title="Show on map"
                  className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    shownOnMap ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <LocateFixed className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : null}
              {onToggleFavorite ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(salon);
                  }}
                  aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
                  aria-pressed={!!isFavorited}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Heart className={`h-4 w-4 ${isFavorited ? "fill-primary text-primary" : ""}`} />
                </button>
              ) : null}
            </div>
          </div>

          {/* The full address is available on hover (and in the map preview). */}
          <p className="mt-0.5 truncate text-sm text-muted-foreground" title={salon.address || salon.location || undefined}>
            {salon.location || "Location not available"}
          </p>
          <p data-testid="service-labels" className="mt-0.5 min-h-4 truncate text-xs text-muted-foreground">
            {(salon.serviceLabels ?? []).slice(0, 3).join(" · ")}
          </p>

          <div className="mt-2.5 flex min-h-5 flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className={`flex items-center gap-1.5 font-semibold ${isOpen ? "text-emerald-700" : "text-muted-foreground"}`}>
              <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${isOpen ? "bg-success" : "bg-muted-foreground/50"}`} />
              {isOpen ? "Open now" : "Closed"}
            </span>
            {isOpen && (
              <span data-testid="wait-badge" className="flex items-center gap-1.5 font-mono text-foreground/80">
                <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${ROW_WAIT_DOT_CLASS[waitBadge.color]}`} />
                <span aria-hidden="true">{waitText}</span>
                <span className="sr-only">{waitBadge.description}</span>
              </span>
            )}
            {salon.distance !== undefined && formatDistance(salon.distance, !!salon.distanceApproximate) ? (
              <span
                className="font-mono text-muted-foreground"
                title={salon.distanceApproximate ? "Approximate distance" : undefined}
              >
                {formatDistance(salon.distance, !!salon.distanceApproximate)}
              </span>
            ) : null}
            {salon.locationQuality === "approximate" ? (
              <span className="text-muted-foreground">Approximate test location</span>
            ) : salon.locationQuality === "missing" && salon.flagMissingLocation ? (
              <span className="text-muted-foreground">Location unavailable</span>
            ) : null}
          </div>

          {/* Below 1024px the action grows to fill its row: beside the price when both fit,
              otherwise on its own full-width row — never an awkward half-wrapped button. */}
          <div className="mt-auto flex flex-wrap items-end justify-between gap-x-3 gap-y-2 pt-3 sm:pt-4">
            {startingPriceLabel !== null ? (
              <p data-testid="starting-price" className="whitespace-nowrap text-foreground">
                {startingPriceLabel.startsWith("From ") ? (
                  <>
                    <span className="text-xs text-muted-foreground">From</span>{" "}
                    <span className="font-mono text-[15px] font-semibold">{priceValue}</span>
                  </>
                ) : (
                  <span className="font-mono text-[15px] font-semibold">{priceValue}</span>
                )}
              </p>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(salon);
              }}
              disabled={!isOpen}
              className={`min-h-10 shrink-0 rounded-lg px-4 text-xs font-semibold transition max-lg:min-w-[8.5rem] max-lg:flex-1 ${
                isOpen
                  ? "bg-primary text-primary-foreground hover:brightness-110 active:scale-[0.98]"
                  : "cursor-not-allowed border border-border text-muted-foreground"
              }`}
            >
              {isOpen ? "Book a Snipp" : "Currently Closed"}
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      custom={index}
      initial="hidden"
      animate="visible"
      variants={cardFloat}
      className="group bg-white rounded-2xl overflow-hidden shadow-[0_20px_40px_rgba(99,14,212,0.06)] transition-all hover:-translate-y-1 cursor-pointer"
      onClick={() => onSelect(salon)}
    >
      <div className="relative h-56 overflow-hidden">
        <img
          src={getSalonImageSrc(salon.image_url)}
          alt={salon?.name ?? "Salon"}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute top-4 right-4 flex items-center gap-2">
          {isOpen ? (
            <span className="bg-[#6ffbbe] text-[#002113] px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm">
              Open
            </span>
          ) : (
            <span className="bg-[#e1e3e4] text-[#191c1d] px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm">
              Closed
            </span>
          )}
          {onToggleFavorite ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(salon);
              }}
              aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
              aria-pressed={!!isFavorited}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/30 backdrop-blur-md transition-transform active:scale-90 hover:bg-black/40"
            >
              <Heart
                className={`h-4 w-4 transition-colors ${
                  isFavorited ? "fill-primary text-primary" : "text-white"
                }`}
              />
            </button>
          ) : null}
        </div>

        {isOpen && (
          <div className="absolute bottom-4 left-4">
            <span
              data-testid="wait-badge"
              className="bg-black/40 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1"
            >
              <span aria-hidden="true" className={`h-2 w-2 rounded-full ${WAIT_DOT_CLASS[waitBadge.color]}`} />
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              <span aria-hidden="true">{waitText}</span>
              <span className="sr-only">{waitBadge.description}</span>
            </span>
          </div>
        )}
      </div>

      <div className="p-6">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-display font-bold text-xl text-foreground line-clamp-1">
            {salon?.name ?? "Unknown Salon"}
          </h3>
          {/* Only a genuine rating is shown; none is available today, so nothing is invented. */}
          {rating !== null && (
            <div className="flex items-center gap-1 text-foreground">
              <Star className="text-primary w-[18px] h-[18px] fill-primary" />
              <span className="font-bold text-sm">{rating}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 text-muted-foreground text-sm mb-6 whitespace-nowrap overflow-hidden text-ellipsis">
          {salon.distance !== undefined && (
            <>
              <span className="flex items-center gap-1 shrink-0">
                <MapPin className="w-[16px] h-[16px]" />
                {salon.distance.toFixed(1)} km
              </span>
              <span className="w-1 h-1 rounded-full bg-[#ccc3d8] shrink-0"></span>
            </>
          )}
          <span className="truncate">{salon.location || "Location not available"}</span>
        </div>

        {startingPriceLabel !== null && (
          <p data-testid="starting-price" className="-mt-4 mb-6 text-sm font-semibold text-foreground">
            {startingPriceLabel}
          </p>
        )}

        <button 
          onClick={(e) => {
            e.stopPropagation();
            onSelect(salon);
          }}
          disabled={!isOpen}
          className="w-full text-white py-3 rounded-full font-bold text-sm tracking-wide shadow-lg hover:brightness-110 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: isOpen ? 'linear-gradient(to right, #7C3AED, #A855F7)' : '#7b7487' }}
        >
          {isOpen ? "Book a Snipp" : "Currently Closed"}
        </button>
      </div>
    </motion.div>
  );
};

export default React.memo(SalonCard);


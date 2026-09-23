import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Clock, MapPin, Scissors } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { publicSupabase } from "@/integrations/supabase/publicClient";
import { Skeleton } from "@/components/design/Skeleton";
import { startBookingFlow } from "@/contexts/BookingDraftContext";

// Same rule SalonPage.tsx uses, duplicated locally so this focused entry
// point doesn't reach into another page's file to share a few lines of pure
// logic — it also intentionally does NOT reuse SalonPage itself, since this
// route only needs to identify the salon and hand off to booking, not show
// the full salon detail experience.
const isWithinOperatingHours = (openTime: string | null, closeTime: string | null): boolean => {
  if (!openTime || !closeTime) return true;
  try {
    const now = new Date();
    const currentTime = now.getHours() * 100 + now.getMinutes();
    const openParts = openTime.split(":").map(Number);
    const closeParts = closeTime.split(":").map(Number);
    const openTimeNum = openParts[0] * 100 + (openParts[1] || 0);
    const closeTimeNum = closeParts[0] * 100 + (closeParts[1] || 0);
    if (openTimeNum <= closeTimeNum) {
      return currentTime >= openTimeNum && currentTime <= closeTimeNum;
    }
    return currentTime >= openTimeNum || currentTime <= closeTimeNum;
  } catch {
    return true;
  }
};

const formatTime12h = (time: string | null): string | null => {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h)) return null;
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m || 0).padStart(2, "0")} ${period}`;
};

const getSalonImageSrc = (imageUrl: string | null) => {
  if (!imageUrl) return "/default-salon.jpg";
  if (imageUrl.startsWith("http") || imageUrl.startsWith("/")) return imageUrl;
  const { data } = supabase.storage.from("salon-images").getPublicUrl(imageUrl);
  return data.publicUrl || "/default-salon.jpg";
};

interface QuickBookingSalon {
  id: string;
  name: string;
  image_url: string | null;
  address: string | null;
  city: string | null;
  open_time: string | null;
  close_time: string | null;
  is_manual_closed: boolean;
}

type LoadState = "loading" | "ready" | "not_found" | "error";

const BrandMark = () => (
  <div className="flex items-center gap-2">
    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-sm">
      <Scissors className="h-5 w-5" aria-hidden="true" />
    </div>
    <span className="font-display text-xl font-bold text-foreground">Snippr</span>
  </div>
);

export default function QuickBooking() {
  const { quickBookingCode } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<LoadState>("loading");
  const [salon, setSalon] = useState<QuickBookingSalon | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const code = quickBookingCode?.trim();
    if (!code) {
      setState("not_found");
      return;
    }

    let cancelled = false;
    setState("loading");

    const fetchSalon = async () => {
      try {
        const fetchPromise = publicSupabase
          .from("salons")
          .select("id, name, image_url, address, city, open_time, close_time, is_manual_closed")
          .eq("quick_booking_code", code)
          .maybeSingle();

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Network timeout")), 8000)
        );

        const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);
        if (cancelled) return;

        if (error) {
          setState("error");
          return;
        }
        if (!data) {
          setState("not_found");
          return;
        }

        setSalon({
          id: data.id,
          name: data.name ?? "Salon",
          image_url: data.image_url ?? null,
          address: data.address ?? null,
          city: data.city ?? null,
          open_time: data.open_time ?? null,
          close_time: data.close_time ?? null,
          is_manual_closed: data.is_manual_closed ?? false,
        });
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    };

    fetchSalon();
    return () => {
      cancelled = true;
    };
  }, [quickBookingCode, retryCount]);

  const isOpen = salon ? !salon.is_manual_closed && isWithinOperatingHours(salon.open_time, salon.close_time) : false;
  const openLabel = salon ? formatTime12h(salon.open_time) : null;
  const closeLabel = salon ? formatTime12h(salon.close_time) : null;

  const handleBookNow = () => {
    if (!salon || !isOpen) return;
    startBookingFlow(salon.id, navigate, undefined, "qr");
  };

  if (state === "loading") {
    return (
      <div className="flex min-h-screen flex-col bg-background px-5 pt-[calc(1.5rem+env(safe-area-inset-top))]">
        <BrandMark />
        <div className="mx-auto mt-8 w-full max-w-sm">
          <Skeleton height={200} borderRadius={24} />
          <div className="mt-6 flex flex-col gap-3">
            <Skeleton width="70%" height={28} />
            <Skeleton width="50%" height={16} />
          </div>
          <div className="mt-10">
            <Skeleton height={56} borderRadius={16} />
          </div>
        </div>
      </div>
    );
  }

  if (state === "not_found") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 pb-[env(safe-area-inset-bottom)]">
        <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 text-destructive shadow-inner">
          <Scissors className="h-10 w-10" aria-hidden="true" />
        </div>
        <div className="text-center">
          <h1 className="mb-2 font-display text-2xl font-bold text-foreground">Salon not found</h1>
          <p className="mx-auto mb-8 max-w-xs text-sm text-muted-foreground">
            That Quick Booking link is invalid or no longer available.
          </p>
          <Link
            to="/salons"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Explore Salons
          </Link>
        </div>
      </div>
    );
  }

  if (state === "error" || !salon) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 pb-[env(safe-area-inset-bottom)]">
        <div className="text-center">
          <h1 className="mb-2 font-display text-xl font-bold text-foreground">Couldn&apos;t load this salon</h1>
          <p className="mx-auto mb-6 max-w-xs text-sm text-muted-foreground">
            Please check your connection and try again.
          </p>
          <button
            type="button"
            onClick={() => setRetryCount((c) => c + 1)}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-primary px-8 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background pb-[calc(6rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))]">
      <div className="mx-auto w-full max-w-md px-5">
        <BrandMark />

        <p className="mt-8 text-xs font-bold uppercase tracking-widest text-primary">Quick Booking</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-foreground">
          You&apos;re booking at {salon.name}
        </h1>

        <div className="relative mt-6 overflow-hidden rounded-3xl shadow-[0_20px_40px_rgba(99,14,212,0.08)]">
          <img
            src={getSalonImageSrc(salon.image_url)}
            alt={salon.name}
            className="h-48 w-full object-cover"
          />
          <span
            className={
              isOpen
                ? "absolute top-3 right-3 rounded-full bg-[#6ffbbe] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#002113] shadow-sm"
                : "absolute top-3 right-3 rounded-full bg-[#e1e3e4] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#191c1d] shadow-sm"
            }
          >
            {isOpen ? "Open" : "Closed"}
          </span>
        </div>

        <div className="mt-5 flex flex-col gap-2 text-sm text-muted-foreground">
          {(salon.address || salon.city) && (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
              {[salon.address, salon.city].filter(Boolean).join(", ")}
            </span>
          )}
          {openLabel && closeLabel && (
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
              {openLabel} &ndash; {closeLabel}
            </span>
          )}
        </div>

        {!isOpen && (
          <div className="mt-6 flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
            <span className="text-sm font-medium text-destructive">
              This salon is currently closed. Booking is unavailable right now.
            </span>
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto w-full max-w-md">
          <button
            type="button"
            onClick={handleBookNow}
            disabled={!isOpen}
            aria-label={isOpen ? `Book at this salon, ${salon.name}` : "Currently closed, booking unavailable"}
            className="flex h-14 w-full items-center justify-center rounded-xl bg-primary text-base font-bold text-primary-foreground transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 motion-safe:active:scale-[0.99]"
          >
            {isOpen ? "Book at this Salon" : "Currently Closed"}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, Clock, Heart, MapPin, Phone, Scissors, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { publicSupabase } from "@/integrations/supabase/publicClient";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/design/Skeleton";
import { ErrorState } from "@/components/design/ErrorState";
import { formatINR } from "@/lib/currency";
import { startBookingFlow } from "@/contexts/BookingDraftContext";
import { pageFade, cardFloat, motionEase } from "@/lib/motion";

const getSalonImageSrc = (imageUrl: string | null) => {
  if (!imageUrl) return "/default-salon.jpg";
  if (imageUrl.startsWith("http") || imageUrl.startsWith("/")) return imageUrl;
  const { data } = supabase.storage.from("salon-images").getPublicUrl(imageUrl);
  return data.publicUrl || "/default-salon.jpg";
};

// Same rule SalonCard.tsx uses for the discovery grid, duplicated locally so this
// page doesn't reach into another page's file to share a few lines of pure logic.
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

interface SalonDetail {
  id: string;
  name: string;
  image_url: string | null;
  address: string;
  city: string;
  phone: string;
  open_time: string;
  close_time: string;
  is_manual_closed: boolean;
  queue_count: number | null;
  wait_time: number | null;
}

export default function SalonPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const [salon, setSalon] = useState<SalonDetail | null>(null);
  const [services, setServices] = useState<{ id: string; name: string; price: number | null; duration: number | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const fetchSalon = async () => {
      if (!id) {
        setErrorMessage("Salon not found");
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorMessage(null);

      try {
        const fetchPromise = publicSupabase
          .from("salon_with_stats" as any)
          .select("id, name, owner_id, image_url, address, city, phone, open_time, close_time, is_manual_closed, queue_count, wait_time")
          .eq("id", id)
          .maybeSingle();

        const timeoutPromise = new Promise<any>((_, reject) => setTimeout(() => reject(new Error("Network timeout")), 8000));

        const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);

        if (error) {
          setErrorMessage("Could not load salon details. Please check your connection.");
          setSalon(null);
        } else if (!data) {
          setErrorMessage("Salon not found.");
          setSalon(null);
        } else {
          const safeSalon: SalonDetail = {
            id: data.id,
            name: data.name ?? "Salon",
            image_url: data.image_url ?? null,
            address: data.address ?? "Address not available",
            city: data.city ?? "City not specified",
            phone: data.phone ?? "",
            open_time: data.open_time ?? "09:00",
            close_time: data.close_time ?? "20:00",
            is_manual_closed: data.is_manual_closed ?? false,
            queue_count: data.queue_count ?? null,
            wait_time: data.wait_time ?? null,
          };
          setSalon(safeSalon);

          const { data: serviceRows } = await publicSupabase
            .from("services")
            .select("id, name, price, duration")
            .eq("salon_id", id)
            .order("name");
          setServices(serviceRows || []);
        }
      } catch {
        setErrorMessage("Connection timed out. Please try again.");
        setSalon(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSalon();
  }, [id, retryCount]);

  useEffect(() => {
    if (!user || !id) return;
    supabase
      .from("customer_favorite_salons")
      .select("id")
      .eq("user_id", user.id)
      .eq("salon_id", id)
      .maybeSingle()
      .then(({ data }) => setIsFavorited(!!data));
  }, [user, id]);

  const toggleFavorite = async () => {
    if (!user || !id || favoriteBusy) return;
    setFavoriteBusy(true);
    const next = !isFavorited;
    setIsFavorited(next);
    if (next) {
      await supabase.from("customer_favorite_salons").insert({ user_id: user.id, salon_id: id });
    } else {
      await supabase.from("customer_favorite_salons").delete().eq("user_id", user.id).eq("salon_id", id);
    }
    setFavoriteBusy(false);
  };

  const headerProps = {
    onSignOut: signOut,
    userName: user ? (user.email || "User") : undefined,
    userEmail: user?.email || undefined,
    profileName: profile?.name || undefined,
    isAdmin: false,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header {...headerProps} />
        <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 sm:px-6">
          <Skeleton height={280} borderRadius={24} />
          <div className="mt-6 flex flex-col gap-3">
            <Skeleton width={220} height={30} />
            <Skeleton width={160} height={16} />
          </div>
          <div className="mt-10 flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={68} borderRadius={16} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (errorMessage || !salon) {
    return (
      <div className="min-h-screen bg-background">
        <Header {...headerProps} />
        <div className="flex items-center justify-center px-6 py-20">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card">
            <ErrorState message={errorMessage || "No data available"} onRetry={() => setRetryCount((c) => c + 1)} />
          </div>
        </div>
      </div>
    );
  }

  const isOpen = !salon.is_manual_closed && isWithinOperatingHours(salon.open_time, salon.close_time);
  const openLabel = formatTime12h(salon.open_time);
  const closeLabel = formatTime12h(salon.close_time);
  const hasQueueData = salon.queue_count !== null && salon.wait_time !== null;
  const cheapestPrice = services.length
    ? Math.min(...services.map((s) => s.price ?? Infinity).filter((p) => Number.isFinite(p)))
    : null;

  return (
    <div className="min-h-screen bg-background">
      <Header {...headerProps} />

      <motion.div
        initial="hidden"
        animate="visible"
        variants={pageFade}
        transition={{ duration: 0.24, ease: motionEase }}
        className="mx-auto w-full max-w-3xl px-4 pb-32 pt-6 sm:px-6 sm:pb-16"
      >
        {/* Back */}
        <button
          type="button"
          onClick={() => navigate("/salons")}
          className="mb-4 inline-flex items-center gap-1 rounded-full py-1.5 pr-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Salons
        </button>

        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl shadow-[0_20px_40px_rgba(99,14,212,0.08)]">
          <img
            src={getSalonImageSrc(salon.image_url)}
            alt={salon.name}
            className="h-64 w-full object-cover sm:h-80"
          />
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <span
              className={
                isOpen
                  ? "rounded-full bg-[#6ffbbe] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#002113] shadow-sm"
                  : "rounded-full bg-[#e1e3e4] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#191c1d] shadow-sm"
              }
            >
              {isOpen ? "Open" : "Closed"}
            </span>
            {user && (
              <button
                type="button"
                onClick={toggleFavorite}
                disabled={favoriteBusy}
                aria-label={isFavorited ? "Remove from favorites" : "Save to favorites"}
                aria-pressed={isFavorited}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-black/30 backdrop-blur-md transition-transform hover:bg-black/40 active:scale-90 disabled:opacity-60"
              >
                <Heart
                  className={`h-4 w-4 transition-colors ${isFavorited ? "fill-primary text-primary" : "text-white"}`}
                  aria-hidden="true"
                />
              </button>
            )}
          </div>

          {hasQueueData && isOpen && (
            <div className="absolute bottom-4 left-4">
              <span className="flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                ~{salon.wait_time}m wait
              </span>
            </div>
          )}
        </div>

        {/* Identity */}
        <div className="mt-6 space-y-3">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            {salon.name}
          </h1>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
              {salon.address}, {salon.city}
            </span>
            {openLabel && closeLabel && (
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
                {openLabel} &ndash; {closeLabel}
              </span>
            )}
            {salon.phone && (
              <span className="flex items-center gap-1.5">
                <Phone className="h-4 w-4 shrink-0" aria-hidden="true" />
                {salon.phone}
              </span>
            )}
          </div>
        </div>

        {/* Live queue */}
        {hasQueueData && (
          <motion.div
            custom={0}
            initial="hidden"
            animate="visible"
            variants={cardFloat}
            className="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-border bg-card px-5 py-4"
          >
            <div>
              <div className="mb-1 flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60 motion-reduce:animate-none" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-success">Live Queue</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Users className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                {salon.queue_count === 0
                  ? "No one waiting"
                  : `${salon.queue_count} ${salon.queue_count === 1 ? "person" : "people"} waiting`}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">~{salon.wait_time} min estimated wait</div>
            </div>
            <span
              className={
                isOpen
                  ? "shrink-0 rounded-full border border-success/25 bg-success/10 px-3 py-1 text-xs font-semibold text-success"
                  : "shrink-0 rounded-full border border-destructive/25 bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive"
              }
            >
              {isOpen ? "Open now" : "Closed"}
            </span>
          </motion.div>
        )}

        {!isOpen && (
          <div className="mt-6 flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
            <span className="text-sm font-medium text-destructive">
              This salon is currently closed. Booking is unavailable right now.
            </span>
          </div>
        )}

        {/* Services */}
        <div className="mt-10">
          <h2 className="font-display text-lg font-bold text-foreground">Services</h2>
          <p className="mb-4 mt-0.5 text-sm text-muted-foreground">Choose what you&apos;d like to book</p>

          {services.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card px-5 py-8 text-center">
              <Scissors className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm font-semibold text-foreground">No services available</p>
              <p className="mt-1 text-sm text-muted-foreground">This salon hasn&apos;t added any bookable services yet.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {services.map((service, i) => (
                <motion.div
                  key={service.id}
                  custom={i}
                  initial="hidden"
                  animate="visible"
                  variants={cardFloat}
                  className="flex min-h-[44px] items-center justify-between rounded-2xl border border-border bg-card px-4 py-3.5"
                >
                  <div className="flex items-center gap-3">
                    <Scissors className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{service.name}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        {service.duration ?? 30} min
                      </p>
                    </div>
                  </div>
                  <p className="font-mono text-sm font-bold text-foreground">{formatINR(service.price ?? 0)}</p>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Booking CTA */}
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-4 backdrop-blur-md sm:static sm:mt-10 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 sm:px-0" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
            {isOpen && cheapestPrice !== null && (
              <span className="hidden text-sm text-muted-foreground sm:block">
                Services from <span className="font-mono font-semibold text-foreground">{formatINR(cheapestPrice)}</span>
              </span>
            )}
            <Button
              size="lg"
              disabled={!isOpen}
              className="h-12 w-full rounded-xl text-base font-bold sm:w-auto sm:min-w-[220px]"
              onClick={() => startBookingFlow(salon.id, navigate)}
            >
              {isOpen ? "Book a Snipp" : "Currently Closed"}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

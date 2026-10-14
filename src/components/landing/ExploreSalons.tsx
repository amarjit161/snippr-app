import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle, Clock3, Scissors } from "lucide-react";
import { DISP, V } from "./tokens";
import { Reveal, Label } from "@/components/design/Reveal";
import { publicSupabase } from "@/integrations/supabase/publicClient";
import { useAppNavigate } from "./useAppNavigate";
import salon1 from "@/assets/salon-1.jpg";
import salon2 from "@/assets/salon-2.jpg";
import salon3 from "@/assets/salon-3.jpg";
import salon4 from "@/assets/salon-4.jpg";

// Decorative stand-ins for salons that haven't uploaded a photo yet. Always
// shown with a "Representative photo" label so they never pass for the salon's
// actual premises.
const REPRESENTATIVE_IMAGES = [salon1, salon2, salon3, salon4];

// Internal test salons that exist in production data but shouldn't be featured
// on the marketing homepage. Homepage-only: they still appear on /salons and the
// data itself is untouched. Exact names — salon_with_stats has no test flag.
const HOMEPAGE_HIDDEN_SALON_NAMES = new Set(["Realtime Proof 876956"]);

type SalonRow = {
  id: string;
  name: string;
  address: string | null;
  location: string | null;
  city: string | null;
  image_url: string | null;
  queue_count: number | null;
  wait_time: number | null;
};

type SlideSalon = {
  id: string;
  name: string;
  tag: string;
  location: string;
  city: string;
  wait: string;
  noQueue: boolean;
  image: string;
  representative: boolean;
  accent: string;
};

function resolveImage(imageUrl: string | null): string | null {
  if (!imageUrl) return null;
  if (imageUrl.startsWith("http") || imageUrl.startsWith("/")) return imageUrl;
  return publicSupabase.storage.from("salon-images").getPublicUrl(imageUrl).data.publicUrl || null;
}

function toSlide(row: SalonRow, index: number): SlideSalon {
  const own = resolveImage(row.image_url);
  const queue = Number(row.queue_count ?? 0);
  const tag = row.address || row.location || "";
  // Owners often enter the same text for address and location; don't repeat it.
  const extra = [row.location !== tag ? row.location : null, row.city]
    .filter((part): part is string => Boolean(part) && !tag.includes(part as string));
  return {
    id: row.id,
    name: row.name,
    tag,
    location: extra.join(", "),
    city: row.city || "",
    // Same live numbers the app's salon list shows (salon_with_stats).
    wait: queue > 0 ? `${queue} in queue · ${Number(row.wait_time ?? 0)}m wait` : "No queue right now",
    noQueue: queue === 0,
    image: own ?? REPRESENTATIVE_IMAGES[index % REPRESENTATIVE_IMAGES.length],
    representative: !own,
    accent: "from-black/30 to-black/85",
  };
}

function SparklesIcon() {
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center">
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M18.5 14l.75 2.25L21.5 17l-2.25.75L18.5 20l-.75-2.25L15.5 17l2.25-.75L18.5 14z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function ExploreSalons() {
  const goApp = useAppNavigate();

  // Real registered salons via the anonymous-safe public client — the same
  // view the app's /salons page reads. No invented salons, ratings or waits.
  const { data: salons = [], isLoading } = useQuery({
    queryKey: ["landing-explore-salons"],
    queryFn: async () => {
      const { data, error } = await publicSupabase
        .from("salon_with_stats" as never)
        .select("id, name, address, location, city, image_url, queue_count, wait_time")
        .limit(8);
      if (error) throw error;
      return ((data ?? []) as unknown as SalonRow[])
        .filter((row) => !HOMEPAGE_HIDDEN_SALON_NAMES.has(row.name))
        .map(toSlide);
    },
    staleTime: 60_000,
  });

  const [activeSalonIndex, setActiveSalonIndex] = useState(0);

  useEffect(() => {
    if (salons.length < 2) return;
    const timer = window.setInterval(() => {
      setActiveSalonIndex((current) => (current + 1) % salons.length);
    }, 4200);
    return () => window.clearInterval(timer);
  }, [salons.length]);

  // Nothing real to show (still loading is handled below; an error or an empty
  // table hides the section rather than falling back to made-up salons).
  if (!isLoading && salons.length === 0) return null;

  const activeSalon = salons[activeSalonIndex % Math.max(salons.length, 1)];
  const nextSalons = salons.filter((_, index) => index !== activeSalonIndex).slice(0, 2);

  return (
    <section data-landing-feature className="py-24 px-6" style={{ background: "#050507" }} aria-labelledby="explore-heading">
      <div className="max-w-6xl mx-auto">
        <Reveal className="mb-12 flex flex-col gap-4 sm:items-end sm:justify-between lg:flex-row">
          <div>
            <Label text="Explore" />
            <h2 id="explore-heading" className="text-3xl sm:text-4xl font-bold tracking-tight text-white"
              style={{ fontFamily: DISP, letterSpacing: "-0.02em" }}>
              Explore Salons
            </h2>
            <p className="mt-2" style={{ color: "rgba(255,255,255,0.4)" }}>Salons taking bookings on Snippr right now</p>
          </div>
          <button onClick={() => goApp("/salons")} className="flex items-center gap-2 font-bold" style={{ color: V }}>
            View all
            <ArrowRight className="h-4 w-4" />
          </button>
        </Reveal>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="group relative min-h-[320px] cursor-pointer overflow-hidden rounded-3xl md:col-span-2 lg:h-[400px]"
            onClick={() => goApp(activeSalon ? `/salon/${activeSalon.id}` : "/salons")}>
            {activeSalon ? (
              <img
                src={activeSalon.image}
                alt={activeSalon.representative ? "" : activeSalon.name}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="h-full min-h-[320px] w-full animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
            )}
            <div className={`absolute inset-0 bg-gradient-to-t ${activeSalon?.accent ?? "from-black/30 to-black/85"}`} />
            {activeSalon && (
              <div className="absolute bottom-0 left-0 w-full p-5 text-white sm:p-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
                  <div>
                    <h3 className="text-xl font-bold sm:text-2xl">{activeSalon.name}</h3>
                    <p className="font-medium opacity-90">{activeSalon.tag}</p>
                    <p className="mt-2 text-sm text-white/80">{activeSalon.location}</p>
                  </div>
                  <div className="flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 backdrop-blur-md">
                    <span className="font-bold">Book</span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-white/90">
                  {activeSalon.city && (
                    <span className="rounded-full bg-white/15 px-3 py-1 font-semibold backdrop-blur-sm">{activeSalon.city}</span>
                  )}
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 font-semibold backdrop-blur-sm">
                    <Clock3 className="h-4 w-4" />
                    {activeSalon.wait}
                  </span>
                </div>
              </div>
            )}

            <div className="absolute left-4 top-4 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-white backdrop-blur-md">
              {activeSalon?.representative ? "Representative photo" : "Live slider"}
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:gap-6">
            {nextSalons.map((salon, i) => {
              const Icon = i % 2 === 1 ? SparklesIcon : Scissors;

              return (
                <div key={salon.id} onClick={() => goApp(`/salon/${salon.id}`)}
                  className="group flex-1 cursor-pointer rounded-3xl border p-5 transition-all sm:p-6"
                  style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: `${V}1A`, color: V }}>
                      <Icon />
                    </div>
                    {salon.city && (
                      <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}>{salon.city}</span>
                    )}
                  </div>
                  <h4 className="text-lg font-bold text-white transition-colors">{salon.name}</h4>
                  <p className="mb-2 mt-1 text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>{salon.tag}</p>
                  <p className="mb-4 text-xs font-medium" style={{ color: "rgba(255,255,255,0.28)" }}>{salon.location}</p>
                  <div className={`flex items-center gap-2 text-sm font-bold ${salon.noQueue ? "text-green-400" : ""}`}
                    style={salon.noQueue ? undefined : { color: "#F59E0B" }}>
                    {salon.noQueue ? <CheckCircle className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                    {salon.wait}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {salons.length > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            {salons.map((_, index) => (
              <button
                key={index}
                onClick={() => setActiveSalonIndex(index)}
                className="h-2 rounded-full transition-all"
                style={{ width: index === activeSalonIndex ? 32 : 8, background: index === activeSalonIndex ? V : "rgba(255,255,255,0.15)" }}
                aria-label={`Go to salon slide ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

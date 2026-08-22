import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle, Clock3, Scissors } from "lucide-react";
import { Star } from "lucide-react";
import { DISP, V } from "./tokens";
import { Reveal, Label } from "@/components/design/Reveal";
import salon1 from "@/assets/salon-1.jpg";
import salon2 from "@/assets/salon-2.jpg";
import salon3 from "@/assets/salon-3.jpg";
import salon4 from "@/assets/salon-4.jpg";

const heroImage = salon1;

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
  const navigate = useNavigate();

  const salons = useMemo(
    () => [
      { name: "The Collective Artistry", tag: "Luxury Styling & Color Bar", location: "Hauz Khas, Delhi", wait: "12 min wait", rating: 4.9, distance: "2.1 km", image: heroImage, accent: "from-black/30 to-black/85" },
      { name: "Urban Groomers", tag: "Modern barbering & grooming lounge.", location: "Connaught Place, Delhi", wait: "5 min wait", rating: 4.8, distance: "2.4 km", image: salon2, accent: "from-black/30 to-black/85" },
      { name: "Aura Wellness", tag: "Holistic hair treatments and scalp spa.", location: "Green Park, Delhi", wait: "Immediate start", rating: 4.7, distance: "0.8 km", image: salon3, accent: "from-black/25 to-black/85" },
      { name: "Velvet Blades", tag: "Minimal cuts with premium flow.", location: "South Extension, Delhi", wait: "9 min wait", rating: 4.8, distance: "1.6 km", image: salon4, accent: "from-black/30 to-black/85" },
      { name: "Crown Studio", tag: "Editorial grooming, fresh trims.", location: "Punjabi Bagh, Delhi", wait: "11 min wait", rating: 4.6, distance: "3.3 km", image: heroImage, accent: "from-black/30 to-black/85" },
    ],
    []
  );

  const [activeSalonIndex, setActiveSalonIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSalonIndex((current) => (current + 1) % salons.length);
    }, 4200);
    return () => window.clearInterval(timer);
  }, [salons.length]);

  const activeSalon = salons[activeSalonIndex];
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
            <p className="mt-2" style={{ color: "rgba(255,255,255,0.4)" }}>Top rated destinations near your current location</p>
          </div>
          <button onClick={() => navigate("/salons")} className="flex items-center gap-2 font-bold" style={{ color: V }}>
            View all
            <ArrowRight className="h-4 w-4" />
          </button>
        </Reveal>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="group relative min-h-[320px] cursor-pointer overflow-hidden rounded-3xl md:col-span-2 lg:h-[400px]" onClick={() => navigate("/salons")}>
            <img
              src={activeSalon?.image ?? "/default-salon.jpg"}
              alt={activeSalon?.name ?? "Salon"}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className={`absolute inset-0 bg-gradient-to-t ${activeSalon?.accent ?? ""}`} />
            <div className="absolute bottom-0 left-0 w-full p-5 text-white sm:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
                <div>
                  <h3 className="text-xl font-bold sm:text-2xl">{activeSalon?.name ?? "Salon"}</h3>
                  <p className="font-medium opacity-90">{activeSalon?.tag ?? ""}</p>
                  <p className="mt-2 text-sm text-white/80">{activeSalon?.location ?? ""}</p>
                </div>
                <div className="flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 backdrop-blur-md">
                  <Star className="h-4 w-4 fill-current text-yellow-400" />
                  <span className="font-bold">{activeSalon?.rating ?? "4.8"}</span>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-white/90">
                <span className="rounded-full bg-white/15 px-3 py-1 font-semibold backdrop-blur-sm">{activeSalon?.distance ?? ""}</span>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 font-semibold backdrop-blur-sm">
                  <Clock3 className="h-4 w-4" />
                  {activeSalon?.wait ?? ""}
                </span>
              </div>
            </div>

            <div className="absolute left-4 top-4 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-white backdrop-blur-md">
              Live slider
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:gap-6">
            {nextSalons.map((salon) => {
              const Icon = (salon?.name ?? "").includes("Aura") ? SparklesIcon : Scissors;

              return (
                <div key={salon?.name ?? "salon"} className="group flex-1 rounded-3xl border p-5 transition-all sm:p-6"
                  style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: `${V}1A`, color: V }}>
                      <Icon />
                    </div>
                    <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}>{salon?.distance ?? ""}</span>
                  </div>
                  <h4 className="text-lg font-bold text-white transition-colors">{salon?.name ?? "Salon"}</h4>
                  <p className="mb-2 mt-1 text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>{salon?.tag ?? ""}</p>
                  <p className="mb-4 text-xs font-medium" style={{ color: "rgba(255,255,255,0.28)" }}>{salon?.location ?? ""}</p>
                  <div className={`flex items-center gap-2 text-sm font-bold ${(salon?.wait ?? "") === "Immediate start" ? "text-green-400" : ""}`}
                    style={(salon?.wait ?? "") === "Immediate start" ? undefined : { color: "#F59E0B" }}>
                    {salon.wait === "Immediate start" ? <CheckCircle className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                    {salon.wait}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

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
      </div>
    </section>
  );
}

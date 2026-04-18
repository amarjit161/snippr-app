import {
  Apple,
  ArrowRight,
  CalendarDays,
  CheckCircle,
  Clock3,
  Globe,
  Hourglass,
  MapPin,
  Scissors,
  Search,
  Share2,
  ShoppingBag,
  Star,
  User,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import gsap from "gsap";
import salon2 from "@/assets/salon-2.jpg";
import salon3 from "@/assets/salon-3.jpg";
import salon4 from "@/assets/salon-4.jpg";

const heroImage = "https://lh3.googleusercontent.com/aida-public/AB6AXuCoI_jZdpbU7WAHr4TBPgjxpF1ABoa9pXOq0hiKsoo38v5El1zmqa9lkv5RidzoO8jdyhOuzv1CDwRXFP-bDVTjBnqtjgJ17LqghNnYUiXXnvZkrGyhs9awWZK92AHSXqpLD2JhfcHH6SyobKibycSVKNFYfUpC8yKjundT_oTA1l6-ABSmHzBKhKNc3QTGgeNj24CoxdxTyEj7IvA9Q0-HLxKgu39Yuv8d88qh40arMjTq8i_DbmwCF8RV_V-TBPzEGdeski_DV1Y";

const navLinkClass = "text-slate-600 font-medium hover:text-violet-600 transition-colors";

export default function Index() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const userLabel = profile?.name?.trim() || user?.email || user?.phone || "U";
  const avatarInitial = userLabel.charAt(0).toUpperCase();
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const searchParams = new URLSearchParams(window.location.search);

    const hasRecoveryInHash = hashParams.get("type") === "recovery";
    const hasRecoveryInQuery = searchParams.get("type") === "recovery";
    const hasRecoveryPayload =
      Boolean(hashParams.get("access_token") && hashParams.get("refresh_token")) ||
      Boolean(searchParams.get("token_hash")) ||
      Boolean(searchParams.get("code"));

    if ((hasRecoveryInHash || hasRecoveryInQuery) && hasRecoveryPayload) {
      const nextUrl = `/auth/callback${window.location.search}${window.location.hash}`;
      console.log("RECOVERY_REDIRECT_FROM_ROOT", {
        hasRecoveryInHash,
        hasRecoveryInQuery,
        nextUrl,
      });
      navigate(nextUrl, { replace: true });
    }
  }, [navigate]);

  const salons = useMemo(
    () => [
      {
        name: "The Collective Artistry",
        tag: "Luxury Styling & Color Bar",
        location: "Hauz Khas, Delhi",
        wait: "12 min wait",
        rating: 4.9,
        distance: "2.1 km",
        image: heroImage,
        accent: "from-[#1f1f1f]/20 to-[#1f1f1f]/70",
      },
      {
        name: "Urban Groomers",
        tag: "Modern barbering & grooming lounge.",
        location: "Connaught Place, Delhi",
        wait: "5 min wait",
        rating: 4.8,
        distance: "2.4 km",
        image: salon2,
        accent: "from-black/20 to-black/75",
      },
      {
        name: "Aura Wellness",
        tag: "Holistic hair treatments and scalp spa.",
        location: "Green Park, Delhi",
        wait: "Immediate start",
        rating: 4.7,
        distance: "0.8 km",
        image: salon3,
        accent: "from-black/15 to-black/80",
      },
      {
        name: "Velvet Blades",
        tag: "Minimal cuts with premium flow.",
        location: "South Extension, Delhi",
        wait: "9 min wait",
        rating: 4.8,
        distance: "1.6 km",
        image: salon4,
        accent: "from-black/20 to-black/80",
      },
      {
        name: "Crown Studio",
        tag: "Editorial grooming, fresh trims.",
        location: "Punjabi Bagh, Delhi",
        wait: "11 min wait",
        rating: 4.6,
        distance: "3.3 km",
        image: heroImage,
        accent: "from-black/20 to-black/75",
      },
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

  const goToBookings = () => {
    if (transitioning) return;

    setTransitioning(true);
    const curtain = document.createElement("div");
    curtain.setAttribute("data-booking-curtain", "true");
    curtain.style.position = "fixed";
    curtain.style.inset = "0";
    curtain.style.zIndex = "9999";
    curtain.style.pointerEvents = "none";
    curtain.style.background = "linear-gradient(135deg, rgba(79,55,138,0.98), rgba(103,80,164,0.88) 45%, rgba(255,255,255,0.96) 100%)";
    curtain.style.transformOrigin = "left center";
    curtain.style.transform = "scaleX(0)";
    curtain.style.filter = "blur(0px)";
    curtain.style.opacity = "0";
    document.body.appendChild(curtain);

    const timeline = gsap.timeline({
      defaults: { duration: 0.16, ease: "power2.out" },
      onComplete: () => {
        navigate("/bookings", { state: { transitionFrom: "landing" } });
        window.setTimeout(() => curtain.remove(), 250);
      },
    });

    timeline
      .to("[data-landing-header]", { y: -2, opacity: 0.96 })
      .to("[data-landing-hero]", { y: 6, opacity: 0.94, scale: 0.995 }, "<")
      .to("[data-landing-feature]", { y: 4, opacity: 0.95, scale: 0.996 }, "<0.01")
      .to("[data-landing-cta]", { y: 4, opacity: 0.95, scale: 0.996 }, "<0.02")
      .to(curtain, { scaleX: 1, opacity: 0.35, duration: 0.12, ease: "power2.inOut" }, "<0.01")
      .to(curtain, { opacity: 0, duration: 0.1 }, ">-0.01");
  };

  return (
    <div className="min-h-screen bg-[#faf9fc] text-[#1a1c1e] antialiased">
      <header data-landing-header className="sticky top-0 z-50 mx-auto flex w-full items-center justify-between bg-[rgba(250,249,252,0.8)] px-6 py-4 shadow-sm backdrop-blur-xl">
        <div className="flex items-center gap-8">
          <span className="text-2xl font-extrabold tracking-tight text-violet-900">snippr</span>
          <nav className="hidden items-center gap-6 md:flex">
            <button className="border-b-2 border-violet-700 font-bold text-violet-700" onClick={() => navigate("/salons")}>Explore</button>
            <button className={navLinkClass} onClick={goToBookings}>Bookings</button>
            <button className={navLinkClass} onClick={() => navigate("/queue")}>Live Queue</button>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <button
              onClick={goToBookings}
              className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-[#6750a4]/20 bg-[#e8e8eb] text-sm font-bold text-[#4f378a]"
              aria-label="User profile"
            >
              {avatarInitial}
            </button>
          ) : (
            <button
              onClick={() => navigate("/login")}
              className="flex h-10 items-center gap-2 rounded-full border border-[#e3e2e5] bg-white px-4 text-sm font-semibold text-[#4f378a] shadow-sm transition hover:bg-[#f4f3f6]"
              aria-label="Sign in"
            >
              <User className="h-4 w-4" />
              Sign in
            </button>
          )}
        </div>
      </header>

      <main>
        <section data-landing-hero className="mx-auto flex max-w-7xl flex-col items-center gap-12 px-6 pb-16 pt-24 lg:flex-row lg:px-16">
          <div className="flex-1 space-y-8">
            <div className="flex flex-wrap gap-3">
              <span className="rounded-full bg-[#e9ddff] px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[#4f378a]">AI Wait Time</span>
              <span className="rounded-full bg-[#ffdbd0] px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[#832600]">Live Queue</span>
              <span className="rounded-full bg-[#ffdf93] px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[#503d00]">Smart ETA</span>
            </div>

            <h1 className="text-5xl font-extrabold leading-[1.1] tracking-tight lg:text-7xl">
              Skip the wait at <br />
              <span className="italic text-[#4f378a]">premium</span> salons.
            </h1>

            <p className="max-w-xl text-xl leading-relaxed text-[#494551]">
              snippr uses predictive intelligence to choreograph your salon visit. No more waiting areas just arrive exactly when your stylist is ready.
            </p>

            <div className="flex flex-col gap-4 sm:flex-row">
              <button
                onClick={() => navigate("/salons")}
                className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-[#4f378a] to-[#6750a4] px-8 py-4 text-lg font-bold text-white shadow-lg transition-all hover:opacity-90"
              >
                Join Queue
                <ArrowRight className="h-5 w-5" />
              </button>
              <button
                onClick={() => navigate("/how-it-works")}
                className="rounded-2xl bg-[#e8e8eb] px-8 py-4 text-lg font-bold text-[#1a1c1e] transition-all hover:bg-[#e3e2e5]"
              >
                How it works
              </button>
            </div>
          </div>

          <div className="relative flex-1">
            <div className="relative z-10 w-full overflow-hidden rounded-3xl shadow-2xl">
              <img src={heroImage} alt="Modern salon interior" className="h-full w-full object-cover" />
            </div>

            <div className="absolute -bottom-6 -left-6 z-20 max-w-[240px] rounded-2xl bg-white p-6 shadow-xl">
              <div className="mb-4 flex items-center gap-3">
                <div className="h-3 w-3 animate-pulse rounded-full bg-[#ab3500]" />
                <span className="text-xs font-bold uppercase tracking-widest text-[#ab3500]">Live Now</span>
              </div>
              <p className="text-3xl font-bold text-[#4f378a]">12 mins</p>
              <p className="text-sm font-medium text-[#494551]">Estimated wait at Luxe Studio</p>
            </div>
          </div>
        </section>

        <section data-landing-feature className="mx-auto max-w-7xl px-6 py-24 lg:px-16">
          <div className="mb-12 flex items-end justify-between">
            <div>
              <h2 className="text-3xl font-bold">Explore Salons</h2>
              <p className="mt-2 font-medium text-[#494551]">Top rated destinations near your current location</p>
            </div>
            <button onClick={() => navigate("/salons")} className="flex items-center gap-2 font-bold text-[#4f378a] hover:underline">
              View all
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="group relative h-[400px] cursor-pointer overflow-hidden rounded-3xl md:col-span-2" onClick={() => navigate("/salons")}>
              <img src={activeSalon.image} alt={activeSalon.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              <div className={`absolute inset-0 bg-gradient-to-t ${activeSalon.accent}`} />
              <div className="absolute bottom-0 left-0 w-full p-8 text-white">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <h3 className="text-2xl font-bold">{activeSalon.name}</h3>
                    <p className="font-medium opacity-90">{activeSalon.tag}</p>
                    <p className="mt-2 text-sm text-white/80">{activeSalon.location}</p>
                  </div>
                  <div className="flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 backdrop-blur-md">
                    <Star className="h-4 w-4 fill-current text-yellow-400" />
                    <span className="font-bold">{activeSalon.rating}</span>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-white/90">
                  <span className="rounded-full bg-white/15 px-3 py-1 font-semibold backdrop-blur-sm">{activeSalon.distance}</span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 font-semibold backdrop-blur-sm">
                    <Clock3 className="h-4 w-4" />
                    {activeSalon.wait}
                  </span>
                </div>
              </div>

              <div className="absolute left-4 top-4 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-white backdrop-blur-md">
                Live slider
              </div>
            </div>

            <div className="flex flex-col gap-6">
              {nextSalons.map((salon) => {
                const Icon = salon.name.includes("Aura") ? SparklesIcon : Scissors;

                return (
                  <div key={salon.name} className="group flex-1 rounded-3xl border border-transparent bg-white p-6 shadow-sm transition-all hover:border-[#4f378a]/10 hover:shadow-md">
                    <div className="mb-4 flex items-start justify-between">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#4f378a]/10 text-[#4f378a]">
                        <Icon />
                      </div>
                      <span className="rounded-full bg-[#e8e8eb] px-3 py-1 text-xs font-bold text-[#494551]">{salon.distance}</span>
                    </div>
                    <h4 className="text-lg font-bold transition-colors group-hover:text-[#4f378a]">{salon.name}</h4>
                    <p className="mb-2 mt-1 text-sm text-[#494551]">{salon.tag}</p>
                    <p className="mb-4 text-xs font-medium text-[#6b6474]">{salon.location}</p>
                    <div className={`flex items-center gap-2 text-sm font-bold ${salon.wait === "Immediate start" ? "text-green-600" : "text-[#ab3500]"}`}>
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
                className={`h-2 rounded-full transition-all ${index === activeSalonIndex ? "w-8 bg-[#4f378a]" : "w-2 bg-[#cbc4d2]"}`}
                aria-label={`Go to salon slide ${index + 1}`}
              />
            ))}
          </div>
        </section>

        <section data-landing-cta className="px-6 py-24">
          <div className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl bg-gradient-to-br from-[#4f378a] to-[#6750a4] p-12 text-center text-white">
            <div className="absolute -right-32 -top-32 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
            <div className="absolute -bottom-32 -left-32 h-64 w-64 rounded-full bg-[#cfbcff]/20 blur-3xl" />

            <div className="relative z-10 mb-4 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-purple-100">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#ffb59d]" />
              App under build
            </div>
            <h2 className="relative z-10 mb-6 text-4xl font-extrabold">Ready to cut the queue?</h2>
            <p className="relative z-10 mx-auto mb-10 max-w-xl text-lg opacity-90">
              snippr app is coming soon. We are building something iconic for your next salon run.
            </p>

            <div className="relative z-10 flex flex-wrap justify-center gap-4">
              <button disabled className="flex cursor-not-allowed items-center gap-2 rounded-2xl bg-white px-8 py-4 font-bold text-[#4f378a] opacity-90">
                <Apple className="h-5 w-5" />
                App Store - Soon
              </button>
              <button disabled className="flex cursor-not-allowed items-center gap-2 rounded-2xl bg-white/20 px-8 py-4 font-bold text-white backdrop-blur-md opacity-85">
                <ShoppingBag className="h-5 w-5" />
                Google Play - Soon
              </button>
            </div>

            <p className="relative z-10 mt-4 text-sm font-medium text-purple-100/90">Early access drops first. Stay tuned.</p>
          </div>
        </section>
      </main>

      <footer className="mt-12 bg-slate-50 px-8 py-16">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 flex flex-col items-start justify-between gap-12 md:flex-row">
            <div className="max-w-sm">
              <span className="mb-4 block text-2xl font-black text-slate-900">snippr</span>
              <p className="text-sm leading-relaxed text-slate-500">
                Redefining the salon experience through intelligent scheduling. Precision in every second, convenience in every click.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-12 sm:grid-cols-3">
              <div>
                <h5 className="mb-4 text-sm font-bold text-slate-900">Product</h5>
                <ul className="space-y-3 text-xs text-slate-500">
                  <li><button className="transition-colors hover:text-orange-600">Explore</button></li>
                  <li><button className="transition-colors hover:text-orange-600">Live Queue</button></li>
                  <li><button className="transition-colors hover:text-orange-600">Bookings</button></li>
                </ul>
              </div>

              <div>
                <h5 className="mb-4 text-sm font-bold text-slate-900">Company</h5>
                <ul className="space-y-3 text-xs text-slate-500">
                  <li><button className="transition-colors hover:text-orange-600" onClick={() => navigate("/careers")}>Careers</button></li>
                  <li><button className="transition-colors hover:text-orange-600" onClick={() => navigate("/owner-dashboard")}>Salon Partner Portal</button></li>
                  <li><button className="transition-colors hover:text-orange-600" onClick={() => navigate("/support")}>Support</button></li>
                </ul>
              </div>

              <div>
                <h5 className="mb-4 text-sm font-bold text-slate-900">Legal</h5>
                <ul className="space-y-3 text-xs text-slate-500">
                  <li><button className="transition-colors hover:text-orange-600" onClick={() => navigate("/privacy")}>Privacy</button></li>
                  <li><button className="transition-colors hover:text-orange-600">Terms</button></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center justify-between gap-6 border-t border-slate-200 pt-8 md:flex-row">
            <p className="text-xs text-slate-500">© 2024 snippr. Precision in every second.</p>
            <div className="flex gap-6">
              <button className="text-slate-400 transition-colors hover:text-orange-600"><Share2 className="h-4 w-4" /></button>
              <button className="text-slate-400 transition-colors hover:text-orange-600"><Globe className="h-4 w-4" /></button>
            </div>
          </div>
        </div>
      </footer>

      <nav className="fixed bottom-0 left-0 z-50 flex w-full items-center justify-around rounded-t-3xl bg-[rgba(250,249,252,0.86)] px-4 pb-6 pt-3 shadow-[0_-8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl md:hidden">
        <button className="flex scale-90 flex-col items-center justify-center rounded-2xl bg-violet-100 px-6 py-2 text-violet-800 transition-all" onClick={() => navigate("/salons")}>
          <Search className="h-5 w-5" />
          <span className="mt-1 text-[10px] font-bold uppercase tracking-widest">Explore</span>
        </button>
        <button className="flex flex-col items-center justify-center rounded-2xl px-6 py-2 text-slate-400 transition-all hover:bg-slate-100" onClick={() => navigate("/bookings")}>
          <CalendarDays className="h-5 w-5" />
          <span className="mt-1 text-[10px] font-bold uppercase tracking-widest">Bookings</span>
        </button>
        <button className="flex flex-col items-center justify-center rounded-2xl px-6 py-2 text-slate-400 transition-all hover:bg-slate-100" onClick={() => navigate("/queue")}>
          <Hourglass className="h-5 w-5" />
          <span className="mt-1 text-[10px] font-bold uppercase tracking-widest">Live Queue</span>
        </button>
        <button className="flex flex-col items-center justify-center rounded-2xl px-6 py-2 text-slate-400 transition-all hover:bg-slate-100" onClick={() => navigate("/login")}>
          <User className="h-5 w-5" />
          <span className="mt-1 text-[10px] font-bold uppercase tracking-widest">Profile</span>
        </button>
      </nav>
    </div>
  );
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

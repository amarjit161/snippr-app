import { CalendarDays, Hourglass, Search, User } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import gsap from "gsap";

// Same "in an active queue" status vocabulary Dashboard.tsx's Upcoming tab uses —
// keep this in sync with that file rather than inventing a second definition.
const ACTIVE_QUEUE_STATUSES = ["pending", "waiting", "confirmed", "accepted", "in_progress"];
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { Hero } from "@/components/landing/Hero";
import { ExploreSalons } from "@/components/landing/ExploreSalons";
import { Problem } from "@/components/landing/Problem";
import { Solution } from "@/components/landing/Solution";
import { JourneySection } from "@/components/landing/JourneySection";
import { MarketingDashboard } from "@/components/landing/MarketingDashboard";
import { AppScreens } from "@/components/landing/AppScreens";
import { Trust } from "@/components/landing/Trust";
import { CTA } from "@/components/landing/CTA";
import { Footer } from "@/components/landing/Footer";

export default function Index() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const searchParams = new URLSearchParams(window.location.search);

    const hashErrorCode = hashParams.get("error_code");
    const hashError = hashParams.get("error");

    const hasRecoveryInHash = hashParams.get("type") === "recovery";
    const hasRecoveryInQuery = searchParams.get("type") === "recovery";
    const hasRecoveryPayload =
      Boolean(hashParams.get("access_token") && hashParams.get("refresh_token")) ||
      Boolean(searchParams.get("token_hash")) ||
      Boolean(searchParams.get("code"));

    // Expired reset links can land on site root with hash errors only.
    // Send users directly to reset page where OTP code fallback is available.
    if (hashErrorCode === "otp_expired" || hashError === "access_denied") {
      navigate("/reset-password?expired=1", { replace: true });
      return;
    }

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

  const goToBookings = async () => {
    if (transitioning) return;

    // "Join Queue" should send an anonymous/no-active-queue customer to salon
    // discovery, and a customer who already has an active queue straight to it
    // (rendered by Dashboard.tsx's "Upcoming" tab — there is no separate
    // customer-facing /queue route; that path is the owner's queue management
    // page). Never invent a fake queue or fake salon data here.
    let destination = "/salons";
    let navState: Record<string, unknown> = { transitionFrom: "landing" };

    if (user) {
      try {
        const { data } = await supabase
          .from("bookings")
          .select("id")
          .eq("customer_id", user.id)
          .in("status", ACTIVE_QUEUE_STATUSES)
          .limit(1)
          .maybeSingle();

        if (data) {
          destination = "/bookings";
          navState = { transitionFrom: "landing", initialTab: "upcoming" };
        }
      } catch (err) {
        console.error("JOIN_QUEUE_ACTIVE_BOOKING_CHECK_FAILED", err);
        // Fall back to salon discovery rather than blocking the click on an error.
      }
    }

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
        navigate(destination, { state: navState });
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
    <div className="min-h-screen antialiased" style={{ background: "#050507" }}>
      <LandingNavbar onBookings={goToBookings} />

      <main>
        <Hero onBookings={goToBookings} />
        <ExploreSalons />
        <Problem />
        <Solution />
        <JourneySection />
        <MarketingDashboard />
        <AppScreens />
        <Trust />
        <CTA />
      </main>

      <Footer />

      <nav className="fixed bottom-0 left-0 z-50 flex w-full items-center justify-around px-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 md:hidden"
        style={{ background: "rgba(5,5,7,0.9)", backdropFilter: "blur(20px)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <button className="flex flex-col items-center justify-center rounded-2xl px-6 py-2 text-white" style={{ background: "#7C3AED" }} onClick={() => navigate("/salons")}>
          <Search className="h-5 w-5" />
          <span className="mt-1 text-[10px] font-bold uppercase tracking-widest">Explore</span>
        </button>
        <button className="flex flex-col items-center justify-center rounded-2xl px-6 py-2" style={{ color: "rgba(255,255,255,0.4)" }} onClick={() => navigate("/bookings")}>
          <CalendarDays className="h-5 w-5" />
          <span className="mt-1 text-[10px] font-bold uppercase tracking-widest">Bookings</span>
        </button>
        <button className="flex flex-col items-center justify-center rounded-2xl px-6 py-2" style={{ color: "rgba(255,255,255,0.4)" }} onClick={() => navigate("/queue")}>
          <Hourglass className="h-5 w-5" />
          <span className="mt-1 text-[10px] font-bold uppercase tracking-widest">Live Queue</span>
        </button>
        <button className="flex flex-col items-center justify-center rounded-2xl px-6 py-2" style={{ color: "rgba(255,255,255,0.4)" }} onClick={() => navigate(user ? "/my-profile" : "/login")}>
          <User className="h-5 w-5" />
          <span className="mt-1 text-[10px] font-bold uppercase tracking-widest">Profile</span>
        </button>
      </nav>
    </div>
  );
}

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import { usePageMeta } from "@/hooks/usePageMeta";
import { MARKETING_ORIGIN, resolveRootAuthTarget } from "@/lib/domains";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { Hero } from "@/components/landing/Hero";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { Features } from "@/components/landing/Features";
import { OwnersSection } from "@/components/landing/OwnersSection";
import { FAQ } from "@/components/landing/FAQ";
import { FAQS } from "@/components/landing/faqData";
import { CTA } from "@/components/landing/CTA";
import { Footer } from "@/components/landing/Footer";
import { BG, BODY } from "@/components/landing/tokens";

const TITLE = "Snippr — Salon booking with a live queue";
const DESCRIPTION =
  "Find a salon, book your services and stylist, and follow the live queue so you arrive when your chair is ready. Snippr also gives salon owners a live queue dashboard.";

// Only facts that are on this page: the organisation and the FAQ shown below.
const STRUCTURED_DATA = JSON.stringify([
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Snippr",
    url: `${MARKETING_ORIGIN}/`,
    logo: `${MARKETING_ORIGIN}/favicon.png`,
    email: "support@snippr.in",
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  },
]);

export default function Index() {
  const navigate = useNavigate();

  usePageMeta({ title: TITLE, description: DESCRIPTION, canonical: `${MARKETING_ORIGIN}/` });

  // Supabase can fall back to the site root for recovery links (or land there
  // with an expired-link error). Route those to the pages that handle them.
  useEffect(() => {
    const target = resolveRootAuthTarget(window.location.search, window.location.hash);
    if (target) navigate(target, { replace: true });
  }, [navigate]);

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen overflow-x-clip text-white antialiased" style={{ background: BG, fontFamily: BODY }}>
        <a href="#main"
          className="sr-only z-[60] rounded-lg bg-white px-4 py-2 font-semibold text-black focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
          Skip to content
        </a>
        <LandingNavbar />
        <main id="main">
          <Hero />
          <HowItWorksSection />
          <Features />
          <OwnersSection />
          <FAQ />
          <CTA />
        </main>
        <Footer />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: STRUCTURED_DATA }} />
      </div>
    </MotionConfig>
  );
}

import { ArrowRight } from "lucide-react";
import { DISP, V, VA } from "./tokens";
import { AppLink } from "./AppLink";
import { FadeIn } from "./Section";

export function CTA() {
  return (
    <section className="px-4 pb-24 sm:px-6" aria-labelledby="cta-heading">
      <FadeIn className="relative mx-auto max-w-6xl overflow-hidden rounded-[32px] border border-white/10 px-6 py-16 text-center sm:px-12"
      >
        <div aria-hidden="true" className="pointer-events-none absolute inset-0"
          style={{ background: `radial-gradient(ellipse at 50% 0%, ${V}55, transparent 60%), linear-gradient(180deg, #0F0B1C, #07070B)` }} />
        <div className="relative">
          <h2 id="cta-heading" className="mx-auto mb-4 max-w-2xl font-extrabold tracking-tight text-white"
            style={{ fontFamily: DISP, fontSize: "clamp(2rem, 5vw, 3.5rem)", lineHeight: 1.05, letterSpacing: "-0.03em" }}>
            Your next haircut, <span style={{ color: VA }}>without the wait.</span>
          </h2>
          <p className="mx-auto mb-8 max-w-lg text-lg text-white/70">
            See which salons are on Snippr and book your slot in a couple of minutes.
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <AppLink to="/salons"
              className="inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 font-semibold text-white transition-[filter] hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
              style={{ background: V }}>
              Book Now <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </AppLink>
            <a href="#owners"
              className="inline-flex items-center justify-center rounded-xl border border-white/15 px-7 py-3.5 font-semibold text-white/90 transition-colors hover:bg-white/[0.06]">
              I own a salon
            </a>
          </div>
        </div>
      </FadeIn>
    </section>
  );
}

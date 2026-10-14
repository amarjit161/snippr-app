import { ArrowRight, BarChart3, CalendarDays, Footprints, ListOrdered, QrCode, Scissors, ShieldCheck, Users } from "lucide-react";
import { V, VA } from "./tokens";
import { AppLink } from "./AppLink";
import { FadeIn, SectionHeading } from "./Section";
import { OwnerQueueMockup } from "./Mockups";

const TOOLS = [
  { icon: ListOrdered, t: "Live queue management", b: "See every booking and walk-in in one queue and move customers through it." },
  { icon: Footprints, t: "Walk-in bookings", b: "Add walk-in customers to the same queue as online bookings." },
  { icon: ShieldCheck, t: "Arrival code verification", b: "Confirm that a booked customer has actually arrived before you call them." },
  { icon: QrCode, t: "Your salon's QR code", b: "Download a printable QR code. Customers scan it to book with you directly." },
  { icon: Scissors, t: "Services & team", b: "Set up your services, durations and the stylists who perform them." },
  { icon: CalendarDays, t: "Calendar & customers", b: "View appointments by day and keep track of the customers who visit." },
  { icon: BarChart3, t: "Analytics & reviews", b: "Understand your bookings and read what customers say." },
  { icon: Users, t: "Salon profile", b: "The photos, location and details customers see before they book." },
];

export function OwnersSection() {
  return (
    <section className="px-4 py-24 sm:px-6" aria-labelledby="owners-heading">
      <div id="owners" className="mx-auto max-w-6xl scroll-mt-24">
        <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <SectionHeading
              id="owners-heading"
              eyebrow="For salon owners"
              title="Run your queue from one screen."
              intro="Snippr gives your salon an online booking page and a live queue dashboard that handles bookings and walk-ins together."
            />
            <FadeIn className="flex flex-col gap-3 sm:flex-row">
              <AppLink to="/owner-signup"
                className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 font-semibold text-white transition-[filter] hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
                style={{ background: V }}>
                List your salon <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </AppLink>
              <AppLink to="/owner-login"
                className="inline-flex items-center justify-center rounded-xl border border-white/15 px-6 py-3.5 font-semibold text-white/90 transition-colors hover:bg-white/[0.06]">
                Owner sign in
              </AppLink>
            </FadeIn>
          </div>

          <FadeIn delay={0.1}>
            <figure>
              <OwnerQueueMockup />
              <figcaption className="mt-4 text-center text-xs text-white/50">Illustrative preview of the owner dashboard</figcaption>
            </figure>
          </FadeIn>
        </div>

        <ul className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TOOLS.map(({ icon: Icon, t, b }, i) => (
            <FadeIn as="li" key={t} delay={(i % 4) * 0.05} className="list-none rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
              <Icon className="mb-3 h-5 w-5" style={{ color: VA }} aria-hidden="true" />
              <h3 className="mb-1.5 font-semibold text-white">{t}</h3>
              <p className="text-sm leading-relaxed text-white/70">{b}</p>
            </FadeIn>
          ))}
        </ul>
      </div>
    </section>
  );
}

import { CalendarRange, Clock3, KeyRound, Layers, QrCode, RefreshCcw, Smartphone, UserCheck } from "lucide-react";
import { VA } from "./tokens";
import { FadeIn, SectionHeading } from "./Section";

const FEATURES = [
  { icon: Clock3, t: "Live queue & wait estimates", b: "See how busy a salon is before you go, and watch your position update after you book." },
  { icon: Layers, t: "Multiple services, one booking", b: "Combine a haircut, beard trim or colour into a single appointment." },
  { icon: UserCheck, t: "Your stylist, or the best available", b: "Book the person you trust, or let Snippr assign whoever is free soonest." },
  { icon: KeyRound, t: "Arrival code check-in", b: "A short code confirms you've arrived, so the salon knows you're ready." },
  { icon: RefreshCcw, t: "Reschedule or cancel", b: "Plans change. Move or cancel your booking from My Bookings." },
  { icon: QrCode, t: "Scan to book at the salon", b: "Scan a salon's Snippr QR code to jump straight to its booking page." },
  { icon: CalendarRange, t: "All your bookings in one place", b: "Upcoming and past appointments, with details, in one list." },
  { icon: Smartphone, t: "Nothing to install", b: "Snippr runs in your phone's browser. Sign in with your phone number or email." },
];

export function Features() {
  return (
    <section className="border-y border-white/[0.06] bg-white/[0.012] px-4 py-24 sm:px-6" aria-labelledby="features-heading">
      <div id="features" className="mx-auto max-w-6xl scroll-mt-24">
        <SectionHeading
          id="features-heading"
          eyebrow="Features"
          title="Everything a salon visit needs."
          intro="Built around the moments that usually go wrong: not knowing the wait, losing your slot, and queueing at the counter."
        />
        <div className="grid gap-px overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.06] sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, t, b }, i) => (
            <FadeIn key={t} delay={(i % 4) * 0.05} className="bg-[#07070B] p-6">
              <Icon className="mb-4 h-5 w-5" style={{ color: VA }} aria-hidden="true" />
              <h3 className="mb-2 font-semibold text-white">{t}</h3>
              <p className="text-sm leading-relaxed text-white/70">{b}</p>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

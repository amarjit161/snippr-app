import { CalendarClock, ListChecks, MapPinned, ScanLine } from "lucide-react";
import { MONO, V, VA } from "./tokens";
import { FadeIn, SectionHeading } from "./Section";
import { BookScreen, DiscoverScreen, PhoneShell, TrackScreen } from "./Mockups";

const STEPS = [
  { icon: MapPinned, t: "Find a salon", b: "Browse salons on Snippr, search by name or area, and sort by distance or current wait." },
  { icon: ListChecks, t: "Choose services & stylist", b: "Pick one or more services. Choose a stylist, or let Snippr assign the best available one." },
  { icon: CalendarClock, t: "Pick a date and time", b: "See open slots for the day you want and confirm your booking in a few taps." },
  { icon: ScanLine, t: "Track the queue & check in", b: "Follow your live queue position, then show your arrival code at the counter." },
];

export function HowItWorksSection() {
  return (
    <section className="px-4 py-24 sm:px-6" aria-labelledby="how-heading">
      <div id="how-it-works" className="mx-auto max-w-6xl scroll-mt-24">
        <SectionHeading
          id="how-heading"
          eyebrow="How it works"
          title={<>From search to seat<br className="hidden sm:block" /> in four steps.</>}
          intro="Snippr turns a salon visit into a booking you can follow — no guessing how long the wait will be."
        />

        <ol className="mb-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ icon: Icon, t, b }, i) => (
            <FadeIn as="li" key={t} delay={i * 0.06} className="list-none rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6">
                <div className="mb-5 flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${V}26` }}>
                    <Icon className="h-5 w-5" style={{ color: VA }} aria-hidden="true" />
                  </span>
                  <span className="text-xs text-white/50" style={{ fontFamily: MONO }}>0{i + 1}</span>
                </div>
                <h3 className="mb-2 text-lg font-semibold text-white">{t}</h3>
                <p className="text-sm leading-relaxed text-white/70">{b}</p>
            </FadeIn>
          ))}
        </ol>

        <FadeIn>
          <figure>
            <div className="flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4 md:grid md:grid-cols-3 md:overflow-visible md:pb-0">
              {[
                { s: <DiscoverScreen />, l: "Illustration: browsing salons with distance and wait information", c: "Discover" },
                { s: <BookScreen />, l: "Illustration: selecting services and a stylist", c: "Book" },
                { s: <TrackScreen />, l: "Illustration: live queue position and arrival code", c: "Track" },
              ].map(({ s, l, c }) => (
                <div key={c} className="snap-center">
                  <PhoneShell label={l}>{s}</PhoneShell>
                  <p className="mt-4 text-center text-sm font-semibold text-white/80">{c}</p>
                </div>
              ))}
            </div>
            <figcaption className="mt-6 text-center text-xs text-white/50">Illustrative previews of the Snippr app</figcaption>
          </figure>
        </FadeIn>
      </div>
    </section>
  );
}

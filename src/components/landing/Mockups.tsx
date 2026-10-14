import { CalendarDays, Check, Clock3, MapPin, Scissors, Search, Sparkles, UserRound, Users } from "lucide-react";
import { V, VA, G, DISP, MONO } from "./tokens";

/*
 * Illustrative UI mockups of the real Snippr flows (discover → book → track,
 * and the owner queue). They use generic placeholder labels — never real or
 * invented business names, ratings or metrics — and every placement is
 * captioned as an illustration on the page.
 */

const card = "rounded-2xl border border-white/[0.07] bg-white/[0.03]";

export function PhoneShell({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      className="relative mx-auto w-[260px] shrink-0 rounded-[38px] border border-white/10 bg-[#0B0B10] p-2.5 shadow-[0_40px_100px_-20px_rgba(124,58,237,0.45)] sm:w-[280px]"
    >
      <div className="absolute left-1/2 top-3 h-5 w-24 -translate-x-1/2 rounded-full bg-black" aria-hidden="true" />
      <div className="h-[520px] overflow-hidden rounded-[30px] bg-[#0E0E15] px-4 pb-4 pt-10 text-white sm:h-[560px]" aria-hidden="true">
        {children}
      </div>
    </div>
  );
}

export function DiscoverScreen() {
  return (
    <div className="flex h-full flex-col gap-3">
      <p className="text-[11px] text-white/60" style={{ fontFamily: MONO }}>Find a salon</p>
      <div className={`${card} flex items-center gap-2 px-3 py-2.5 text-xs text-white/60`}>
        <Search className="h-3.5 w-3.5" /> Search salons or areas
      </div>
      <div className="flex gap-2 text-[10px]">
        <span className="rounded-full px-2.5 py-1 font-semibold text-white" style={{ background: V }}>Nearest</span>
        <span className="rounded-full border border-white/10 px-2.5 py-1 text-white/60">Shortest wait</span>
      </div>
      {["Sample Salon", "Example Studio", "Neighbourhood Barber"].map((name, i) => (
        <div key={name} className={`${card} p-3`}>
          <div className="mb-2 h-16 rounded-xl" style={{ background: `linear-gradient(135deg, ${V}${i === 0 ? "55" : "30"}, #1a1530)` }} />
          <p className="text-sm font-semibold">{name}</p>
          <div className="mt-1 flex items-center justify-between text-[10px] text-white/60">
            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> Near you</span>
            <span className="flex items-center gap-1" style={{ color: i === 0 ? G : "#FBBF24" }}>
              <Clock3 className="h-3 w-3" /> {i === 0 ? "Short wait" : "In queue"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function BookScreen() {
  return (
    <div className="flex h-full flex-col gap-3">
      <p className="text-[11px] text-white/60" style={{ fontFamily: MONO }}>Step 1 of 4 · Services</p>
      <p className="text-lg font-bold" style={{ fontFamily: DISP }}>What are you in for?</p>
      {[
        { n: "Haircut", d: "30 min", on: true },
        { n: "Beard trim", d: "15 min", on: true },
        { n: "Hair colour", d: "60 min", on: false },
        { n: "Head massage", d: "20 min", on: false },
      ].map((s) => (
        <div key={s.n} className={`${card} flex items-center justify-between p-3`}
          style={s.on ? { borderColor: `${V}90`, background: `${V}1F` } : undefined}>
          <div>
            <p className="text-sm font-semibold">{s.n}</p>
            <p className="text-[10px] text-white/60">{s.d}</p>
          </div>
          <span className="flex h-5 w-5 items-center justify-center rounded-full border"
            style={s.on ? { background: V, borderColor: V } : { borderColor: "rgba(255,255,255,0.2)" }}>
            {s.on && <Check className="h-3 w-3" />}
          </span>
        </div>
      ))}
      <div className={`${card} flex items-center gap-2 p-3 text-xs text-white/70`}>
        <UserRound className="h-4 w-4" style={{ color: VA }} /> Stylist: best available
      </div>
      <div className="mt-auto rounded-xl py-3 text-center text-sm font-semibold" style={{ background: V }}>
        Continue · 2 services
      </div>
    </div>
  );
}

export function TrackScreen() {
  return (
    <div className="flex h-full flex-col gap-3">
      <p className="text-[11px] text-white/60" style={{ fontFamily: MONO }}>Your booking</p>
      <div className={`${card} p-4 text-center`}>
        <p className="text-[10px] uppercase tracking-[0.18em] text-white/60">Queue position</p>
        <p className="my-1 text-6xl font-extrabold" style={{ fontFamily: DISP, color: VA }}>#2</p>
        <p className="text-xs text-white/70">You're next after the current customer</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-2/3 rounded-full" style={{ background: `linear-gradient(90deg, ${V}, ${VA})` }} />
        </div>
      </div>
      <div className={`${card} p-4`}>
        <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-white/60">Arrival code</p>
        <div className="flex justify-between gap-1.5">
          {["4", "8", "1", "6"].map((d, i) => (
            <span key={i} className="flex h-11 flex-1 items-center justify-center rounded-lg text-xl font-bold"
              style={{ background: `${V}26`, fontFamily: MONO }}>{d}</span>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-white/60">Show this at the counter when you arrive</p>
      </div>
      <div className={`${card} space-y-2 p-3 text-xs text-white/70`}>
        <p className="flex items-center gap-2"><Scissors className="h-3.5 w-3.5" style={{ color: VA }} /> Haircut + Beard trim</p>
        <p className="flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5" style={{ color: VA }} /> Today, evening slot</p>
      </div>
      <div className="mt-auto grid grid-cols-2 gap-2 text-xs font-semibold">
        <span className="rounded-xl border border-white/10 py-2.5 text-center text-white/80">Reschedule</span>
        <span className="rounded-xl border border-white/10 py-2.5 text-center text-white/80">Cancel</span>
      </div>
    </div>
  );
}

export function OwnerQueueMockup() {
  const rows = [
    { n: "Customer A", s: "Haircut", st: "In chair", c: G },
    { n: "Customer B", s: "Beard trim", st: "Arrived · code verified", c: VA },
    { n: "Walk-in", s: "Haircut", st: "Waiting", c: "rgba(255,255,255,0.6)" },
    { n: "Customer C", s: "Hair colour", st: "Booked", c: "rgba(255,255,255,0.6)" },
  ];
  return (
    <div role="img" aria-label="Illustration of the Snippr owner dashboard queue"
      className="overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0B0B10] shadow-[0_40px_100px_-30px_rgba(124,58,237,0.5)]">
      <div aria-hidden="true">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: V }}>
              <Scissors className="h-3.5 w-3.5 text-white" />
            </span>
            <span className="text-sm font-semibold text-white" style={{ fontFamily: DISP }}>Your salon · Today's queue</span>
          </div>
          <span className="hidden items-center gap-1.5 text-[11px] font-semibold sm:flex" style={{ color: G }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: G }} /> Live
          </span>
        </div>
        <div className="grid gap-px bg-white/[0.06] sm:grid-cols-[1fr_220px]">
          <div className="space-y-2 bg-[#0B0B10] p-4">
            {rows.map((r) => (
              <div key={r.n} className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06]">
                  <Users className="h-3.5 w-3.5 text-white/70" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{r.n}</p>
                  <p className="text-[11px] text-white/60">{r.s}</p>
                </div>
                <span className="text-right text-[11px] font-semibold" style={{ color: r.c }}>{r.st}</span>
              </div>
            ))}
          </div>
          <div className="space-y-3 bg-[#0B0B10] p-4">
            <div className="rounded-xl border border-dashed p-3 text-center" style={{ borderColor: `${V}70` }}>
              <Sparkles className="mx-auto mb-1 h-4 w-4" style={{ color: VA }} />
              <p className="text-xs font-semibold text-white">Add walk-in</p>
              <p className="text-[10px] text-white/60">Slots into the same queue</p>
            </div>
            <div className="rounded-xl bg-white p-3">
              <div className="mx-auto grid h-20 w-20 grid-cols-5 gap-0.5">
                {Array.from({ length: 25 }).map((_, i) => (
                  <span key={i} className="rounded-[1px]"
                    style={{ background: [0, 1, 3, 4, 5, 9, 12, 15, 19, 20, 21, 23, 24, 7, 17].includes(i) ? "#111" : "transparent" }} />
                ))}
              </div>
              <p className="mt-1.5 text-center text-[10px] font-semibold text-zinc-700">Scan to book</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { ArrowRight, Clock3, Sparkles, Wand2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

const flowSteps = [
  {
    title: "Pick Your Vibe",
    description: "Explore top salons, compare wait times, and lock your spot in seconds.",
    accent: "from-[#ffd7cc] to-[#fff0eb]",
  },
  {
    title: "Get Smart ETA",
    description: "snippr tracks live queue movement and keeps recalculating your best arrival time.",
    accent: "from-[#e7ddff] to-[#f4efff]",
  },
  {
    title: "Walk In Right On Time",
    description: "No random waiting room scroll sessions. Arrive when your stylist is almost ready.",
    accent: "from-[#ffe8a8] to-[#fff7dd]",
  },
];

export default function HowItWorks() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#f8f7fb] text-[#1a1c1e]">
      <main className="mx-auto max-w-6xl px-6 pb-20 pt-14 md:px-10">
        <section className="relative overflow-hidden rounded-[36px] border border-[#e8e3f1] bg-white p-8 shadow-[0_20px_60px_rgba(79,55,138,0.08)] md:p-12">
          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#e7ddff] blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-[#ffd8c8] blur-3xl" />

          <div className="relative z-10 max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#ece6f9] px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-[#4f378a]">
              <Sparkles className="h-3.5 w-3.5" />
              How snippr works
            </span>

            <h1 className="mt-6 text-4xl font-black leading-tight tracking-tight md:text-6xl">
              No more waiting room energy.
              <br />
              <span className="text-[#4f378a]">snippr keeps your timing clean.</span>
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[#4b4556]">
              snippr is a smart queue and booking layer for modern salons. We combine live queue signals with predictive timing,
              so your salon run feels smooth, sharp, and actually on schedule.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={() => navigate("/salons")}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#4f378a] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#432d74]"
              >
                Explore salons
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => navigate("/")}
                className="rounded-2xl border border-[#ddd6e8] bg-white px-6 py-3 text-sm font-semibold text-[#2c2636] transition hover:bg-[#f6f3fb]"
              >
                Back home
              </button>
            </div>
          </div>
        </section>

        <section className="mt-12 grid gap-5 md:grid-cols-3">
          {flowSteps.map((step, index) => (
            <article key={step.title} className="rounded-3xl border border-[#ece8f3] bg-white p-6 shadow-sm">
              <div className={`mb-5 inline-flex rounded-2xl bg-gradient-to-br px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-[#4f378a] ${step.accent}`}>
                Step {index + 1}
              </div>
              <h2 className="text-2xl font-bold text-[#1f1b26]">{step.title}</h2>
              <p className="mt-3 text-[15px] leading-relaxed text-[#5d576a]">{step.description}</p>
            </article>
          ))}
        </section>

        <section className="mt-12 grid gap-6 md:grid-cols-[1.35fr_1fr]">
          <article className="rounded-3xl bg-[#191523] p-8 text-white shadow-[0_16px_40px_rgba(25,21,35,0.28)]">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-[#ffd79b]">
              <Wand2 className="h-3.5 w-3.5" />
              Our vision
            </div>
            <h3 className="text-3xl font-black leading-tight md:text-4xl">Build the operating system for salon time.</h3>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-[#d4cdde]">
              We believe grooming should feel premium from booking to chair. Our vision is a world where nobody wastes hours in queues,
              salons run sharper, and every appointment feels effortlessly on point.
            </p>
            <p className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-[#bca8ff]">Fast. Fair. Fresh.</p>
          </article>

          <article className="rounded-3xl border border-[#ece8f3] bg-white p-7">
            <div className="flex items-center gap-3 text-[#4f378a]">
              <Clock3 className="h-5 w-5" />
              <p className="text-sm font-bold uppercase tracking-widest">Why people love snippr</p>
            </div>

            <ul className="mt-5 space-y-4 text-sm text-[#453f51]">
              <li className="rounded-2xl bg-[#f5f2fb] px-4 py-3">Queue updates that feel live, not delayed.</li>
              <li className="rounded-2xl bg-[#fff6f1] px-4 py-3">Cleaner schedules for salons and customers.</li>
              <li className="rounded-2xl bg-[#f3f9ff] px-4 py-3">Modern booking experience built for today.</li>
            </ul>
          </article>
        </section>
      </main>
    </div>
  );
}

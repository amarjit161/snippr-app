import { ArrowRight, Mail, Sparkles, Users, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Careers() {
  const navigate = useNavigate();

  const perks = [
    {
      icon: Sparkles,
      title: "Build in public",
      text: "Ship fast, keep it clean, and help shape the voice of snippr from day one.",
    },
    {
      icon: Zap,
      title: "Move like a startup",
      text: "Small team energy, real ownership, and no corporate maze.",
    },
    {
      icon: Users,
      title: "Create real impact",
      text: "Make salon life smoother for customers, owners, and barbers.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#faf9fc] text-[#1a1c1e]">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-[32px] bg-gradient-to-br from-[#4f378a] to-[#6750a4] px-6 py-16 text-center text-white shadow-sm sm:px-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-purple-100">
            <Sparkles className="h-3.5 w-3.5" /> Careers at snippr
          </span>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-5xl">Come build the vibe.</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-purple-100 sm:text-lg">
            We’re a small startup with big energy. If you love shipping beautiful products, moving fast, and making real-world experiences feel effortless, you’ll fit right in.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="mailto:info@snippr.in?subject=snippr%20careers%20-%20let's%20build"
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3 font-bold text-[#4f378a] transition hover:bg-slate-50"
            >
              <Mail className="h-4 w-4" />
              Reach out: info@snippr.in
            </a>
            <button
              onClick={() => navigate("/")}
              className="inline-flex items-center gap-2 rounded-2xl bg-white/15 px-6 py-3 font-bold text-white transition hover:bg-white/25"
            >
              Back to home <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>

        <section className="mt-10 grid gap-6 md:grid-cols-3">
          {perks.map((perk) => {
            const Icon = perk.icon;
            return (
              <article key={perk.title} className="rounded-3xl bg-white p-6 shadow-sm">
                <div className="mb-4 inline-flex rounded-2xl bg-purple-50 p-3 text-[#4f378a]">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="text-xl font-semibold text-[#1a1c1e]">{perk.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">{perk.text}</p>
              </article>
            );
          })}
        </section>

        <section className="mt-10 rounded-[28px] bg-white p-8 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-[#4f378a]">Why snippr</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight">A tiny team. A real product. A lot of momentum.</h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
            We’re building a modern salon experience that feels premium, quick, and genuinely useful. If you want to contribute, learn fast, and help turn a strong idea into a standout brand, let’s talk.
          </p>
        </section>
      </main>
    </div>
  );
}

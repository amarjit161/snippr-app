import { ArrowLeft, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Privacy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#f8f7fb] text-[#1a1c1e]">
      <main className="mx-auto max-w-5xl px-6 pb-20 pt-14 md:px-10">
        <section className="relative overflow-hidden rounded-[34px] border border-[#e8e3f1] bg-white p-8 shadow-[0_20px_60px_rgba(79,55,138,0.08)] md:p-12">
          <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[#e7ddff] blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-[#ffd8c8] blur-3xl" />

          <div className="relative z-10 max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#ece6f9] px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-[#4f378a]">
              <ShieldCheck className="h-3.5 w-3.5" />
              Privacy
            </span>

            <h1 className="mt-6 text-4xl font-black leading-tight tracking-tight md:text-6xl">Your privacy matters.</h1>

            <p className="mt-6 text-lg leading-relaxed text-[#4b4556]">
              snippr only uses your data to run bookings, queue timing, and support. We do not sell your personal data.
            </p>

            <div className="mt-8 rounded-2xl border border-[#ede8f4] bg-[#faf8ff] p-5">
              <p className="text-sm font-semibold text-[#453f51]">
                Product note: snippr is currently in developing mode, and privacy terms may be refined as features evolve.
              </p>
            </div>

            <div className="mt-8 space-y-4 text-sm leading-relaxed text-[#4f495a]">
              <p>We collect basic account and booking data such as name, phone, and queue activity.</p>
              <p>We use this data to improve booking flow, provide live updates, and resolve support issues.</p>
              <p>If you want data correction or deletion, contact us at help@snippr.in.</p>
            </div>

            <button
              onClick={() => navigate(-1)}
              className="mt-10 inline-flex items-center gap-2 rounded-2xl border border-[#ddd6e8] bg-white px-5 py-3 text-sm font-semibold text-[#2c2636] transition hover:bg-[#f6f3fb]"
            >
              <ArrowLeft className="h-4 w-4" />
              Go back
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
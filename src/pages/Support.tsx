import { ArrowLeft, Headphones, Mail, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Support() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#f8f7fb] text-[#1a1c1e]">
      <main className="mx-auto max-w-5xl px-6 pb-20 pt-14 md:px-10">
        <section className="relative overflow-hidden rounded-[34px] border border-[#e8e3f1] bg-white p-8 shadow-[0_20px_60px_rgba(79,55,138,0.08)] md:p-12">
          <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[#e7ddff] blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-[#ffd8c8] blur-3xl" />

          <div className="relative z-10 max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#ece6f9] px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-[#4f378a]">
              <Headphones className="h-3.5 w-3.5" />
              Support
            </span>

            <h1 className="mt-6 text-4xl font-black leading-tight tracking-tight md:text-6xl">
              Need help?
              <br />
              <span className="text-[#4f378a]">We got you.</span>
            </h1>

            <p className="mt-6 text-lg leading-relaxed text-[#4b4556]">
              snippr support is real humans, quick replies, and zero corporate robot vibe. If something feels off,
              drop us a note and we will fix it fast.
            </p>

            <div className="mt-8 rounded-2xl border border-[#ede8f4] bg-[#faf8ff] p-5">
              <p className="text-sm leading-relaxed text-[#453f51]">
                Right now we are a lean team, so reply time can sometimes take a little longer. But every message is read by our team and answered with care.
              </p>
            </div>

            <div className="mt-7 inline-flex items-center gap-3 rounded-2xl bg-[#1e1929] px-5 py-4 text-white">
              <Mail className="h-4.5 w-4.5 text-[#cdb6ff]" />
              <a href="mailto:help@snippr.in" className="text-sm font-semibold tracking-wide text-[#f7f4ff] hover:text-white">
                help@snippr.in
              </a>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={() => navigate(-1)}
                className="inline-flex items-center gap-2 rounded-2xl border border-[#ddd6e8] bg-white px-5 py-3 text-sm font-semibold text-[#2c2636] transition hover:bg-[#f6f3fb]"
              >
                <ArrowLeft className="h-4 w-4" />
                Go back
              </button>
              <button
                onClick={() => navigate("/")}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#4f378a] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#432d74]"
              >
                Home
                <Sparkles className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
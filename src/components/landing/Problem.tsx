import { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { V, DISP } from "./tokens";
import { Reveal, Label } from "@/components/design/Reveal";

const QUEUE_NAMES = [
  "Alex M.", "Priya N.", "Sam K.", "Jordan P.", "Chris R.",
  "Morgan T.", "Riley S.", "Casey B.", "Drew L.", "Jamie K.", "Parker W.", "Quinn A.",
];

export function Problem() {
  const queueRef  = useRef<HTMLDivElement>(null);
  const [queueVis, setQueueVis] = useState(false);
  const [waitMin,  setWaitMin]  = useState(0);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setQueueVis(true); }, { threshold: 0.3 });
    if (queueRef.current) obs.observe(queueRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!queueVis) return;
    let n = 0;
    const id = setInterval(() => { n++; setWaitMin(n); if (n >= 37) clearInterval(id); }, 30);
    return () => clearInterval(id);
  }, [queueVis]);

  return (
    <section className="py-24 px-6 border-y" style={{ background: "#050507", borderColor: "rgba(255,255,255,0.06)" }} aria-labelledby="problem-heading">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <Label text="The Problem" />
          <h2 id="problem-heading" className="text-4xl md:text-5xl font-bold tracking-tight mb-4 leading-[1.04] text-white"
            style={{ fontFamily: DISP, letterSpacing: "-0.025em" }}>
            The wait no one<br />plans for.
          </h2>
          <p className="text-lg max-w-md mb-10" style={{ color: "rgba(255,255,255,0.4)" }}>
            Walk in. Get told it's 45 minutes. Leave frustrated.
            This happens millions of times a day at salons with no queue system.
          </p>
        </Reveal>

        <div ref={queueRef} aria-label="Queue visualization">
          <div className="flex flex-wrap gap-2 mb-10" role="list" aria-label="Customers waiting in queue">
            {QUEUE_NAMES.map((name, i) => {
              const done = i < 2;
              return (
                <div key={i} role="listitem" aria-label={done ? `${name}, served` : `${name}, position ${i + 1}`}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
                  style={{
                    background: done ? "rgba(255,255,255,0.05)" : `rgba(124,58,237,${0.12 + i * 0.035})`,
                    border: `1px solid ${done ? "rgba(255,255,255,0.06)" : `rgba(124,58,237,${0.18 + i * 0.03})`}`,
                    transform: queueVis ? "translateX(0)" : "translateX(50px)",
                    opacity: queueVis ? 1 : 0,
                    transition: `transform 0.55s cubic-bezier(0.34,1.56,0.64,1) ${i * 65}ms, opacity 0.4s ease ${i * 65}ms`,
                  }}>
                  <div aria-hidden="true" style={{ width: 18, height: 18, borderRadius: "50%",
                    background: done ? "rgba(255,255,255,0.08)" : V,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 8, color: done ? "rgba(255,255,255,0.3)" : "#fff", fontWeight: 700 }}>
                    {done ? "✓" : i + 1}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 500, color: done ? "rgba(255,255,255,0.3)" : "#fff" }}>{name}</span>
                </div>
              );
            })}
          </div>

          <div className="grid md:grid-cols-[auto_1fr] gap-10 items-start">
            <div>
              <div className="font-extrabold leading-none tabular-nums" aria-live="polite" aria-label={`${waitMin} minutes`}
                style={{ fontFamily: DISP, fontSize: "clamp(4rem, 12vw, 9rem)", color: V, letterSpacing: "-0.04em" }}>
                {waitMin}
              </div>
              <p className="text-lg mt-2" style={{ color: "rgba(255,255,255,0.4)" }}>minutes wasted per visit</p>
            </div>
            <div className="grid sm:grid-cols-3 gap-4 content-start">
              {[
                { stat: "30%",   desc: "of salon visits end in walkout due to unknown wait time" },
                { stat: "0%",    desc: "of traditional salons offer real-time queue visibility" },
                { stat: "₹35K Cr", desc: "in annual revenue lost to no-shows and walk-outs" },
              ].map(({ stat, desc }, i) => (
                <motion.article key={stat}
                  initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.6 }}
                  whileHover={{ y: -2 }}
                  className="p-5 rounded-2xl border"
                  style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
                  <div className="text-3xl font-bold mb-2" style={{ fontFamily: DISP, color: V }}>{stat}</div>
                  <p className="text-sm leading-snug" style={{ color: "rgba(255,255,255,0.4)" }}>{desc}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

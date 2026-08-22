import { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, TrendingUp, Star, BarChart3 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { V, G, DISP, MONO } from "./tokens";
import { formatINR } from "@/lib/currency";
import { Reveal, Label } from "@/components/design/Reveal";

const REVENUE = [
  { d: "Mon", v: 1240 }, { d: "Tue", v: 1820 }, { d: "Wed", v: 1540 },
  { d: "Thu", v: 2100 }, { d: "Fri", v: 2680 }, { d: "Sat", v: 3200 }, { d: "Sun", v: 1900 },
];

const DASH_CLIENTS = [
  { n: "Marcus W.", svc: "Haircut",  st: "James", status: "In Chair", sc: G        },
  { n: "Priya N.",  svc: "Color",    st: "Aisha", status: "Up Next",  sc: V        },
  { n: "Sam K.",    svc: "Beard",    st: "James", status: "8 min",    sc: "#71717A" },
  { n: "Jordan P.", svc: "Haircut",  st: "TBD",   status: "22 min",   sc: "#71717A" },
  { n: "Chris R.",  svc: "Shape Up", st: "Aisha", status: "35 min",   sc: "#71717A" },
];

export function MarketingDashboard() {
  const dashRef   = useRef<HTMLDivElement>(null);
  const [dashChart, setDashChart] = useState(false);
  const [liveRev,   setLiveRev]   = useState(2140);

  useEffect(() => {
    const id = setInterval(() => setLiveRev(r => r + Math.floor(Math.random() * 18) + 6), 2800);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setDashChart(true); }, { threshold: 0.2 });
    if (dashRef.current) obs.observe(dashRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section className="py-24 px-6 border-y" style={{ background: "#050507", borderColor: "rgba(255,255,255,0.06)" }} aria-labelledby="dashboard-heading">
      <div className="max-w-6xl mx-auto">
        <Reveal className="mb-12">
          <Label text="For Salon Owners" />
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <h2 id="dashboard-heading" className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.04] text-white"
              style={{ fontFamily: DISP, letterSpacing: "-0.025em" }}>
              Your salon,<br />fully in control.
            </h2>
            <p className="text-lg max-w-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
              Real-time queue management, live analytics, and revenue insights — one screen.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div ref={dashRef} className="rounded-3xl overflow-hidden"
            style={{
              background: "rgba(255,255,255,0.022)",
              border: "1px solid rgba(255,255,255,0.06)",
              backdropFilter: "blur(20px) saturate(160%)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 32px 80px rgba(0,0,0,0.25)",
            }}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: V }} aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12l4 6-10 13L2 9z"/><path d="M11 3L8 9l4 13 4-13-3-6"/><path d="M2 9h20"/></svg>
                </div>
                <span className="font-bold text-white" style={{ fontFamily: DISP }}>Fade District</span>
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>· Atlanta, GA</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)", fontFamily: MONO }}>Updated just now</span>
                <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: G }}>
                  <div className="w-1.5 h-1.5 rounded-full live-dot" style={{ background: G }} aria-hidden="true" />
                  Live
                </div>
              </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              {[
                { icon: Users,      l: "In Queue",     v: "12",   sub: "5 with stylist", live: false },
                { icon: TrendingUp, l: "Revenue",      v: null,   sub: "Today",           live: true  },
                { icon: Star,       l: "Rating",       v: "4.9",  sub: "Last 30 days",   live: false },
                { icon: BarChart3,  l: "Active Staff", v: "3",    sub: "of 4 scheduled", live: false },
              ].map(({ icon: Icon, l, v, sub, live }) => (
                <div key={l} className="px-5 py-4" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                  <div className="flex items-center gap-1.5 text-xs mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>
                    <Icon className="w-3.5 h-3.5" aria-hidden="true" />{l}
                  </div>
                  <div className="text-2xl font-bold tabular-nums text-white" style={{ fontFamily: DISP }}>
                    {live ? formatINR(liveRev) : v}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{sub}</div>
                </div>
              ))}
            </div>

            {/* Clients + chart */}
            <div className="grid md:grid-cols-[1fr_300px] divide-x" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              <div className="p-5">
                <h3 className="text-xs font-semibold mb-3 tracking-wider uppercase"
                  style={{ fontFamily: MONO, color: "rgba(255,255,255,0.4)" }}>Today's Queue</h3>
                <div className="space-y-2">
                  {DASH_CLIENTS.map((c, i) => (
                    <motion.div key={i} whileHover={{ x: 3 }} transition={{ duration: 0.15 }}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.03)" }}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                        style={{ background: V }} aria-hidden="true">{c.n[0]}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate text-white">{c.n}</div>
                        <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{c.svc} · {c.st}</div>
                      </div>
                      <div className="text-xs font-semibold" style={{ color: c.sc }}>{c.status}</div>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="p-5">
                <h3 className="text-xs font-semibold mb-1 tracking-wider uppercase"
                  style={{ fontFamily: MONO, color: "rgba(255,255,255,0.4)" }}>Revenue this week</h3>
                <div className="text-2xl font-bold mb-4 text-white" style={{ fontFamily: DISP }}>{formatINR(14480)}</div>

                {!dashChart ? (
                  <div style={{ height: 148, borderRadius: 12, position: "relative", overflow: "hidden",
                    background: "rgba(255,255,255,0.03)" }} aria-label="Loading chart">
                    <div style={{ position: "absolute", top: 0, bottom: 0, width: "50%",
                      background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)",
                      animation: "shimmer 1.4s ease-in-out infinite" }} />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={148}>
                    <AreaChart data={REVENUE} key="chart">
                      <defs>
                        <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={V} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={V} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="d" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#71717A" }} />
                      <YAxis hide />
                      <Tooltip contentStyle={{ background: "#0E0E14",
                        border: `1px solid ${V}25`, borderRadius: 10, fontSize: 11 }}
                        formatter={(v) => [formatINR(v as number), "Revenue"]} />
                      <Area type="monotone" dataKey="v" stroke={V} strokeWidth={2} fill="url(#rg)"
                        dot={false} isAnimationActive animationDuration={1200} animationEasing="ease-out"
                        activeDot={{ r: 3, fill: V, strokeWidth: 0 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

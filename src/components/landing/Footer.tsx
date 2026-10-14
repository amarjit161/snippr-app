import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Scissors, Share2, Globe, Mail } from "lucide-react";
import { V, G, BG, DISP, MONO } from "./tokens";
import { useAppNavigate } from "./useAppNavigate";
import { MARKETING_ORIGIN } from "@/lib/domains";

export function Footer() {
  const navigate = useNavigate();
  const goApp = useAppNavigate();
  const [linkCopied, setLinkCopied] = useState(false);

  const share = async () => {
    const url = `${MARKETING_ORIGIN}/`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Snippr", url });
      } else {
        await navigator.clipboard.writeText(url);
        setLinkCopied(true);
        window.setTimeout(() => setLinkCopied(false), 2000);
      }
    } catch {
      // Share sheet dismissed or clipboard blocked — nothing to do.
    }
  };

  const columns = [
    { h: "Product", links: [
        { l: "Explore", onClick: () => goApp("/salons") },
        // Customer live queue = My Bookings → Upcoming (/queue is the owner-only queue page).
        { l: "Live Queue", onClick: () => goApp("/bookings", { initialTab: "upcoming" }) },
      ] },
    { h: "Company", links: [
        { l: "Careers", onClick: () => navigate("/careers") },
        { l: "Salon Partner Portal", onClick: () => goApp("/owner-login") },
        { l: "Support", onClick: () => navigate("/support") },
      ] },
    { h: "Legal", links: [
        { l: "Privacy", onClick: () => navigate("/privacy") },
        { l: "Terms", onClick: undefined as (() => void) | undefined },
      ] },
  ];

  return (
    <footer className="border-t py-12 px-6" style={{ background: BG, borderColor: "rgba(255,255,255,0.05)" }}>
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-start justify-between gap-10 mb-10">
          <div className="max-w-[220px]">
            <button onClick={() => navigate("/")} className="flex items-center gap-2 mb-3" aria-label="Snippr home">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: V }} aria-hidden="true">
                <Scissors className="w-3 h-3 text-white" />
              </div>
              <span className="font-bold text-white" style={{ fontFamily: DISP }}>Snippr</span>
            </button>
            <p className="text-xs leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.25)" }}>
              Skip the Wait. Get the Chair.<br />
              Real-time salon queue management.
            </p>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full live-dot" style={{ background: G }} aria-hidden="true" />
              <span className="text-[10px]" style={{ color: G, fontFamily: MONO }}>Live salon queues</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-8 text-sm">
            {columns.map(({ h, links }) => (
              <div key={h}>
                <p className="font-semibold mb-3" style={{ color: "rgba(255,255,255,0.55)", fontSize: 12 }}>{h}</p>
                {links.map(({ l, onClick }) => (
                  <button key={l} onClick={onClick} disabled={!onClick} className="block mb-2.5 text-xs transition-colors text-left"
                    style={{ color: "rgba(255,255,255,0.24)", cursor: onClick ? "pointer" : "default" }}
                    onMouseEnter={e => onClick && (e.currentTarget.style.color = "rgba(255,255,255,0.55)")}
                    onMouseLeave={e => onClick && (e.currentTarget.style.color = "rgba(255,255,255,0.24)")}>
                    {l}
                  </button>
                ))}
              </div>
            ))}
          </div>

          {/* Contact (replaces the old newsletter form, which stored nothing) */}
          <div className="min-w-[200px]">
            <p className="text-xs font-semibold mb-3" style={{ color: "rgba(255,255,255,0.55)" }}>Get in touch</p>
            <p className="text-xs mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>Questions or salon partnerships</p>
            <a href="mailto:support@snippr.in"
              className="w-full inline-flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold text-white"
              style={{ background: V }}>
              <Mail className="h-3.5 w-3.5" aria-hidden="true" /> support@snippr.in
            </a>
          </div>
        </div>

        <div className="pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{ borderColor: "rgba(255,255,255,0.05)" }}>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)", fontFamily: MONO }}>
            © 2026 Snippr. Precision in every second.
          </p>
          <div className="flex gap-6">
            <button onClick={share} aria-label={linkCopied ? "Link copied" : "Share Snippr"} className="transition-colors" style={{ color: linkCopied ? G : "rgba(255,255,255,0.24)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.55)")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.24)")}>
              <Share2 className="h-4 w-4" />
            </button>
            <a href={`${MARKETING_ORIGIN}/`} aria-label="Snippr website" className="transition-colors" style={{ color: "rgba(255,255,255,0.24)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.55)")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.24)")}>
              <Globe className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

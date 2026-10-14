import { motion } from "framer-motion";
import { KeyRound, Zap, Users, Scissors } from "lucide-react";
import { V, VA, DISP } from "./tokens";
import { Reveal } from "@/components/design/Reveal";

// Same layout as the original social-proof band, but only with things the
// product actually does — no ratings, review counts, testimonials, usage
// numbers or certifications until there are verified figures to show.
export function Trust() {
  return (
    <section className="py-20 px-6 border-y" style={{ background: "#050507", borderColor: "rgba(255,255,255,0.06)" }} aria-labelledby="trust-heading">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <Reveal className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-10">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: V }} aria-hidden="true">
              <Scissors className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 id="trust-heading" className="text-sm font-bold text-white">Built for real salon days</h2>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>For customers and salon owners alike</p>
            </div>
          </div>
          <p className="text-sm max-w-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>
            Bookings, walk-ins and arrivals in one live queue — so the counter always knows who's next.
          </p>
        </Reveal>

        {/* Highlights */}
        <div className="grid grid-cols-3 gap-8 mb-8">
          {[
            { value: "OTP", label: "Arrival verification" },
            { value: "QR",  label: "Scan-to-book at the salon" },
            { value: "1",   label: "Queue for bookings & walk-ins" },
          ].map(({ value, label }) => (
            <motion.div key={label} className="text-center" whileHover={{ scale: 1.04 }} transition={{ duration: 0.2 }}>
              <div className="font-display text-primary" style={{ fontFamily: DISP, fontSize: "clamp(2rem,5vw,3.5rem)", fontWeight: 800,
                lineHeight: 1, letterSpacing: "-0.03em" }}>
                {value}
              </div>
              <p className="text-sm font-medium text-muted-foreground mt-2">{label}</p>
            </motion.div>
          ))}
        </div>

        {/* Badges */}
        <Reveal>
          <div className="flex flex-wrap items-center justify-center gap-6 pt-6 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            {[
              { icon: KeyRound, label: "Phone OTP sign-in"            },
              { icon: Zap,      label: "Real-time queue updates"      },
              { icon: Users,    label: "Owner dashboard for your team" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                <Icon className="w-3.5 h-3.5" style={{ color: VA }} aria-hidden="true" />
                {label}
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

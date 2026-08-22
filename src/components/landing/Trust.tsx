import { Star, Shield, Zap, Users } from "lucide-react";
import { VA } from "./tokens";
import { Reveal } from "@/components/design/Reveal";
import { AvatarStack } from "@/components/design/AvatarStack";
import { StatCounter } from "@/components/design/StatCounter";

export function Trust() {
  return (
    <section className="py-20 px-6 border-y" style={{ background: "#050507", borderColor: "rgba(255,255,255,0.06)" }} aria-labelledby="trust-heading">
      <div className="max-w-6xl mx-auto">
        {/* Social proof header */}
        <Reveal className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-10">
          <div className="flex items-center gap-4 flex-wrap">
            <AvatarStack />
            <div>
              <div className="flex items-center gap-1 mb-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-[#F59E0B] text-[#F59E0B]" aria-hidden="true" />
                ))}
                <span className="text-sm font-bold ml-1.5 text-white">4.9</span>
              </div>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>from 12,000+ reviews</p>
            </div>
          </div>
          <blockquote className="text-sm italic max-w-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>
            "Snippr transformed how we manage our queue. Revenue is up 22% and customers love it."
            <footer className="not-italic font-semibold mt-1 text-white text-xs">— Marcus W., Fade District</footer>
          </blockquote>
        </Reveal>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-8 mb-8">
          {[
            { value: 50000,   suffix: "+", label: "Active Customers"    },
            { value: 2000000, suffix: "+", label: "Bookings Processed"  },
            { value: 1200,    suffix: "+", label: "Partner Salons"      },
          ].map(({ value, suffix, label }) => (
            <StatCounter key={label} value={value} suffix={suffix} label={label} />
          ))}
        </div>

        {/* Trust badges */}
        <Reveal>
          <div className="flex flex-wrap items-center justify-center gap-6 pt-6 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            {[
              { icon: Shield, label: "SOC 2 Compliant"                          },
              { icon: Zap,    label: "99.9% Uptime"                             },
              { icon: Users,  label: "Trusted across India & Southeast Asia"    },
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

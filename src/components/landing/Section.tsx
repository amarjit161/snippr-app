import { motion } from "framer-motion";
import { DISP, MONO, VA } from "./tokens";

/** Scroll-in fade. Honours prefers-reduced-motion via the page's MotionConfig. */
export function FadeIn({ children, delay = 0, className = "", as = "div" }: {
  children: React.ReactNode; delay?: number; className?: string; as?: "div" | "li";
}) {
  const Tag = as === "li" ? motion.li : motion.div;
  return (
    <Tag
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </Tag>
  );
}

export function SectionHeading({ id, eyebrow, title, intro, center = false }: {
  id: string; eyebrow: string; title: React.ReactNode; intro?: string; center?: boolean;
}) {
  return (
    <FadeIn className={`mb-12 max-w-2xl ${center ? "mx-auto text-center" : ""}`}>
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: VA, fontFamily: MONO }}>{eyebrow}</p>
      <h2 id={id} className="text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl"
        style={{ fontFamily: DISP, letterSpacing: "-0.025em", lineHeight: 1.05 }}>
        {title}
      </h2>
      {intro && <p className="mt-4 text-lg leading-relaxed text-white/70">{intro}</p>}
    </FadeIn>
  );
}

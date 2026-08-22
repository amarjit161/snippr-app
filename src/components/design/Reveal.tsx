import { motion } from "framer-motion";
import { fadeUp } from "../../lib/animations";

export function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div variants={fadeUp} initial="hidden" whileInView="visible"
      viewport={{ once: true, margin: "-60px" }} transition={{ delay } as never} className={className}>
      {children}
    </motion.div>
  );
}

export function Label({ text }: { text: string }) {
  return (
    <p className="text-[10px] font-semibold tracking-[0.18em] uppercase mb-3 text-accent font-mono" aria-hidden="true">
      {text}
    </p>
  );
}

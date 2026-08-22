import { motion } from "framer-motion";
import { useCountUp } from "../../hooks/useCountUp";

export function StatCounter({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  const { ref, count } = useCountUp(value);
  return (
    <motion.div className="text-center" whileHover={{ scale: 1.04 }} transition={{ duration: 0.2 }}>
      <div className="font-display text-primary" style={{ fontSize: "clamp(2rem,5vw,3.5rem)", fontWeight: 800,
        lineHeight: 1, letterSpacing: "-0.03em" }}>
        <span ref={ref}>{count.toLocaleString("en-IN")}</span>{suffix}
      </div>
      <p className="text-sm font-medium text-muted-foreground mt-2">{label}</p>
    </motion.div>
  );
}

import { useRef, useEffect, useState } from "react";

export function useCountUp(target: number, duration = 2200) {
  const [count, setCount] = useState(0);
  const ref   = useRef<HTMLSpanElement>(null);
  const fired = useRef(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || fired.current) return;
      fired.current = true;
      const t0 = Date.now();
      const id = setInterval(() => {
        const p = Math.min((Date.now() - t0) / duration, 1);
        setCount(Math.round((1 - Math.pow(1 - p, 3)) * target));
        if (p >= 1) clearInterval(id);
      }, 16);
    }, { threshold: 0.5 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [target, duration]);
  return { ref, count };
}

import { forwardRef, useState, useCallback } from "react";

type RippleProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & { as?: "a" };

export const RippleLink = forwardRef<HTMLAnchorElement, RippleProps>(
  ({ children, onClick, style, className, ...rest }, ref) => {
    const [ripples, setRipples] = useState<{ x: number; y: number; id: number }[]>([]);
    const handle = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      const id = Date.now();
      setRipples(prev => [...prev, { x: e.clientX - r.left, y: e.clientY - r.top, id }]);
      setTimeout(() => setRipples(prev => prev.filter(p => p.id !== id)), 650);
      onClick?.(e);
    }, [onClick]);

    return (
      <a ref={ref} onClick={handle} style={{ position: "relative", overflow: "hidden", ...style }} className={className} {...rest}>
        {children}
        {ripples.map(rp => (
          <span key={rp.id} aria-hidden="true" style={{
            position: "absolute", left: rp.x - 40, top: rp.y - 40, width: 80, height: 80,
            borderRadius: "50%", background: "rgba(255,255,255,0.18)",
            animation: "ripple 0.65s ease-out forwards", pointerEvents: "none",
          }} />
        ))}
      </a>
    );
  },
);
RippleLink.displayName = "RippleLink";

// Presentation-only constants ported from the Figma redesign export that can't
// be expressed as Tailwind classes (consumed as inline-style values instead).

export const mag = { transition: "transform 0.3s cubic-bezier(0.34,1.56,0.64,1)" };

export const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.72' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")";

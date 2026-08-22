export const easeOut = [0.16, 1, 0.3, 1] as const;

export const fadeUp = {
  hidden:  { opacity: 0, y: 24, filter: "blur(8px)" },
  visible: { opacity: 1, y: 0,  filter: "blur(0px)", transition: { duration: 0.75, ease: easeOut } },
};

export const stagger = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};

export const heroLine = {
  hidden:  { opacity: 0, y: 36, filter: "blur(12px)" },
  visible: { opacity: 1, y: 0,  filter: "blur(0px)", transition: { duration: 1, ease: easeOut } },
};

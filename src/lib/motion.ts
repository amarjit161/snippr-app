export const motionEase = [0.16, 1, 0.3, 1] as const;

export const pageFade = {
  hidden: { opacity: 0, y: 6, scale: 0.995 },
  visible: { opacity: 1, y: 0, scale: 1 },
};

export const cardFloat = {
  hidden: { opacity: 0, y: 10 },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.18,
      delay: index * 0.035,
      ease: motionEase,
    },
  }),
};

export const modalMotion = {
  hidden: { opacity: 0, scale: 0.99, y: 4 },
  visible: { opacity: 1, scale: 1, y: 0 },
};

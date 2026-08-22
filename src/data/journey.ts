export const J_STEPS = [
  { pos: 7, wait: 28, time: "2:09 PM", stage: 0 },
  { pos: 6, wait: 24, time: "2:15 PM", stage: 0 },
  { pos: 5, wait: 20, time: "2:21 PM", stage: 1 },
  { pos: 4, wait: 16, time: "2:27 PM", stage: 1 },
  { pos: 3, wait: 12, time: "2:33 PM", stage: 2 },
  { pos: 2, wait:  8, time: "2:39 PM", stage: 3 },
  { pos: 1, wait:  4, time: "2:45 PM", stage: 3, notify: true },
  { pos: 0, wait:  0, time: "2:51 PM", stage: 4, done: true  },
] as const;

export const J_STAGES = [
  { n: "01", title: "Queue Joined",  body: "You're in. Snippr has your spot — no need to wait at the door." },
  { n: "02", title: "Live Progress", body: "Moving up. Your estimated wait updates every time a client is served." },
  { n: "03", title: "Almost Ready",  body: "Three spots left. Time to head back toward the salon." },
  { n: "04", title: "You're Next",   body: "One client ahead. Your stylist is finishing up. Head to the front desk." },
  { n: "05", title: "Chair Ready",   body: "Walk straight in — Marcus B. is waiting for you right now." },
];

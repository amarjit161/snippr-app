import type { QueueStatus, QueueTransitionContext } from "./types";

const TRANSITIONS: Record<QueueStatus, QueueStatus[]> = {
  WAITING: ["CONFIRMED", "ARRIVING", "CANCELLED", "EXPIRED", "NO_SHOW"],
  CONFIRMED: ["ARRIVING", "SEATED", "CANCELLED", "EXPIRED", "NO_SHOW"],
  ARRIVING: ["SEATED", "CANCELLED", "NO_SHOW"],
  SEATED: ["IN_SERVICE", "CANCELLED"],
  IN_SERVICE: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  NO_SHOW: [],
  EXPIRED: [],
  CANCELLED: [],
};

function normalize(status: string): QueueStatus {
  return status.toUpperCase() as QueueStatus;
}

export function canTransition(fromRaw: string, toRaw: string, ctx: QueueTransitionContext = {}) {
  const from = normalize(fromRaw);
  const to = normalize(toRaw);
  if (ctx.force && ctx.actor === "admin") return true;
  return (TRANSITIONS[from] || []).includes(to);
}

export function assertTransition(fromRaw: string, toRaw: string, ctx: QueueTransitionContext = {}) {
  if (!canTransition(fromRaw, toRaw, ctx)) {
    throw new Error(`Invalid transition: ${fromRaw} -> ${toRaw}`);
  }
}

export function toLegacyStatus(status: QueueStatus) {
  // Preserve compatibility with existing lowercase statuses in current UI code.
  switch (status) {
    case "IN_SERVICE":
      return "in_progress";
    case "CONFIRMED":
      return "accepted";
    default:
      return status.toLowerCase();
  }
}

export function fromLegacyStatus(status: string): QueueStatus {
  if (status === "in_progress") return "IN_SERVICE";
  if (status === "accepted") return "CONFIRMED";
  return normalize(status);
}

export const queueStateMachine = {
  canTransition,
  assertTransition,
  toLegacyStatus,
  fromLegacyStatus,
};

export default queueStateMachine;

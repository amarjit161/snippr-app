import type { QueueRowLike } from "./types";

export type QueueLifecycleEventName =
  | "QUEUE_CREATED"
  | "STATUS_TRANSITION"
  | "QUEUE_TIMEOUT"
  | "QUEUE_NO_SHOW"
  | "QUEUE_EXPIRED"
  | "QUEUE_COMPLETED"
  | "ADMIN_OVERRIDE"
  | "WEBSOCKET_RECOVERED"
  | "EVENT_DEDUPED";

export type QueueLifecycleEvent = {
  name: QueueLifecycleEventName;
  queueId: string;
  salonId?: string | null;
  fromStatus?: string;
  toStatus?: string;
  seq?: number;
  payload?: Record<string, unknown>;
  occurredAt: string;
};

export function buildTransitionEvent(row: QueueRowLike, fromStatus: string, toStatus: string, payload?: Record<string, unknown>): QueueLifecycleEvent {
  return {
    name: "STATUS_TRANSITION",
    queueId: row.id,
    salonId: (row.salon_id as string | undefined) || null,
    fromStatus,
    toStatus,
    payload,
    occurredAt: new Date().toISOString(),
  };
}

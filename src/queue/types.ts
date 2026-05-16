export const QUEUE_STATUSES = [
  "WAITING",
  "CONFIRMED",
  "ARRIVING",
  "SEATED",
  "IN_SERVICE",
  "COMPLETED",
  "NO_SHOW",
  "EXPIRED",
  "CANCELLED",
] as const;

export type QueueStatus = (typeof QUEUE_STATUSES)[number];

export type QueueTransitionContext = {
  force?: boolean;
  actor?: "customer" | "owner" | "admin" | "system";
};

export type QueueRowLike = {
  id: string;
  status: string;
  row_version?: number;
  updated_at?: string | null;
  created_at?: string;
  [key: string]: unknown;
};

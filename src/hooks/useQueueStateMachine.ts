import { useMemo, useReducer } from "react";
import type { QueueRowLike } from "@/queue/types";

type State = {
  byId: Record<string, QueueRowLike>;
  order: string[];
};

type Action =
  | { type: "SET_ALL"; items: QueueRowLike[] }
  | { type: "UPSERT"; item: QueueRowLike }
  | { type: "REMOVE"; id: string }
  | { type: "RECONCILE"; items: QueueRowLike[] };

function sortIds(ids: string[], byId: Record<string, QueueRowLike>) {
  return [...ids].sort((a, b) => {
    const ia = byId[a];
    const ib = byId[b];
    if (!ia || !ib) return 0;
    const aPos = (ia.position as number | null | undefined) ?? Number.MAX_SAFE_INTEGER;
    const bPos = (ib.position as number | null | undefined) ?? Number.MAX_SAFE_INTEGER;
    if (aPos !== bPos) return aPos - bPos;
    return new Date((ia.created_at as string) || 0).getTime() - new Date((ib.created_at as string) || 0).getTime();
  });
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_ALL": {
      const byId: Record<string, QueueRowLike> = {};
      for (const item of action.items) byId[item.id] = item;
      const order = sortIds(Object.keys(byId), byId);
      return { byId, order };
    }
    case "UPSERT": {
      const byId = { ...state.byId, [action.item.id]: { ...(state.byId[action.item.id] || {}), ...action.item } };
      const ids = new Set(state.order);
      ids.add(action.item.id);
      const order = sortIds(Array.from(ids), byId);
      return { byId, order };
    }
    case "REMOVE": {
      const byId = { ...state.byId };
      delete byId[action.id];
      const order = state.order.filter((id) => id !== action.id);
      return { byId, order };
    }
    case "RECONCILE": {
      const byId = { ...state.byId };
      for (const item of action.items) {
        byId[item.id] = { ...(byId[item.id] || {}), ...item };
      }
      const order = sortIds(Object.keys(byId), byId);
      return { byId, order };
    }
    default:
      return state;
  }
}

export function useQueueStateMachine(initialItems: QueueRowLike[] = []) {
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const byId: Record<string, QueueRowLike> = {};
    for (const item of initialItems) byId[item.id] = item;
    return { byId, order: sortIds(Object.keys(byId), byId) };
  });

  const items = useMemo(() => state.order.map((id) => state.byId[id]).filter(Boolean), [state.byId, state.order]);

  return {
    items,
    dispatch,
  };
}

export default useQueueStateMachine;

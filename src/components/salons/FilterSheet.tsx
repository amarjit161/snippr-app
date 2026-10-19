/**
 * "All filters" for /salons: a bottom sheet on phones, a centred dialog from sm
 * up. Selections are drafted here and applied with "Show N salons", with a live
 * count of matching salons; closing (×, Escape, overlay) discards the draft.
 * Built on the app's Radix Dialog dependency (focus trap, Escape, labelling).
 */
import { useEffect, useState, type RefObject } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import {
  EMPTY_FILTERS,
  toggleIn,
  type DiscoveryFilterState,
  type PriceBandId,
  type ServiceCategoryId,
} from "@/lib/salonFilters";

interface Option<Id> {
  id: Id;
  label: string;
  count: number;
}

interface FilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: DiscoveryFilterState;
  onApply: (next: DiscoveryFilterState) => void;
  options: {
    categories: Option<ServiceCategoryId>[];
    priceBands: Option<PriceBandId>[];
    openNow: number;
    shortWait: number;
  };
  /** How many salons a draft would show (same logic as the page). */
  countFor: (draft: DiscoveryFilterState) => number;
  returnFocusTo?: RefObject<HTMLElement>;
}

const eyebrow = "font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground";

function CheckRow({
  checked,
  onChange,
  label,
  count,
  hint,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  count: number;
  hint?: string;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/70">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-5 w-5 shrink-0 cursor-pointer rounded accent-[hsl(var(--primary))]"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
      </span>
      <span className="shrink-0 font-mono text-xs text-muted-foreground" aria-label={`${count} ${count === 1 ? "salon" : "salons"}`}>
        {count}
      </span>
    </label>
  );
}

export function FilterSheet({ open, onOpenChange, value, onApply, options, countFor, returnFocusTo }: FilterSheetProps) {
  const [draft, setDraft] = useState<DiscoveryFilterState>(value);

  // Each opening starts from the applied filters.
  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  const matching = countFor(draft);
  const resultLabel = matching === 1 ? "Show 1 salon" : `Show ${matching} salons`;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-black/50 motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          onCloseAutoFocus={(event) => {
            if (!returnFocusTo?.current) return;
            event.preventDefault();
            returnFocusTo.current.focus();
          }}
          className="fixed inset-x-0 bottom-0 z-[60] flex max-h-[88dvh] flex-col rounded-t-2xl border border-border bg-card text-foreground shadow-xl outline-none motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:slide-in-from-bottom sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[85vh] sm:w-[28rem] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl motion-safe:sm:data-[state=open]:slide-in-from-bottom-0 motion-safe:sm:data-[state=open]:zoom-in-95"
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <span aria-hidden="true" className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-muted sm:hidden" />
            <DialogPrimitive.Title className="font-display text-lg font-semibold tracking-[-0.01em]">Filters</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              Choose filters, then show the matching salons.
            </DialogPrimitive.Description>
            <DialogPrimitive.Close
              aria-label="Close filters"
              className="-mr-2 flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </DialogPrimitive.Close>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
            <fieldset>
              <legend className={`px-2 pb-1 ${eyebrow}`}>Availability</legend>
              <CheckRow
                label="Open now"
                count={options.openNow}
                checked={draft.openNow}
                onChange={() => setDraft((d) => ({ ...d, openNow: !d.openNow }))}
              />
              <CheckRow
                label="Short wait"
                hint="Open, with a live wait of 15 minutes or less"
                count={options.shortWait}
                checked={draft.shortWait}
                onChange={() => setDraft((d) => ({ ...d, shortWait: !d.shortWait }))}
              />
            </fieldset>

            {options.categories.length > 0 ? (
              <fieldset>
                <legend className={`px-2 pb-1 ${eyebrow}`}>Services</legend>
                {options.categories.map((c) => (
                  <CheckRow
                    key={c.id}
                    label={c.label}
                    count={c.count}
                    checked={draft.categories.includes(c.id)}
                    onChange={() => setDraft((d) => ({ ...d, categories: toggleIn(d.categories, c.id) }))}
                  />
                ))}
              </fieldset>
            ) : null}

            {options.priceBands.length > 0 ? (
              <fieldset>
                <legend className={`px-2 pb-1 ${eyebrow}`}>Starting price</legend>
                <p className="px-2 pb-1 text-xs text-muted-foreground">Based on each salon's lowest listed service price.</p>
                {options.priceBands.map((b) => (
                  <CheckRow
                    key={b.id}
                    label={b.label}
                    count={b.count}
                    checked={draft.priceBands.includes(b.id)}
                    onChange={() => setDraft((d) => ({ ...d, priceBands: toggleIn(d.priceBands, b.id) }))}
                  />
                ))}
              </fieldset>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
            <button
              type="button"
              onClick={() => setDraft(EMPTY_FILTERS)}
              className="min-h-11 rounded-lg px-3 text-sm font-semibold text-foreground underline-offset-4 hover:underline"
            >
              Clear all
            </button>
            <button
              type="button"
              onClick={() => {
                onApply(draft);
                onOpenChange(false);
              }}
              className="min-h-11 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:brightness-110"
            >
              {resultLabel}
            </button>
            <p className="sr-only" aria-live="polite">
              {matching === 1 ? "1 salon matches" : `${matching} salons match`}
            </p>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

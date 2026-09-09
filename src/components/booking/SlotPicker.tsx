import { useSlotAvailability } from "@/hooks/useSlotAvailability";
import { Calendar, RotateCcw, AlertCircle, Sunrise, Sun, Sunset, Lock } from "lucide-react";

interface SlotPickerProps {
  salonId: string;
  date: string; // YYYY-MM-DD
  barberId?: string;
  selectedSlot: string;
  onSlotSelect: (timeValue: string, timeLabel: string) => void;
}

interface SlotGroup {
  label: string;
  icon: typeof Sunrise;
  slots: any[];
}

export function SlotPicker({
  salonId,
  date,
  barberId,
  selectedSlot,
  onSlotSelect,
}: SlotPickerProps) {
  const {
    slots,
    loading,
    availableCount,
    totalCount,
    holidayInfo,
    lastUpdated,
    error,
    refresh,
  } =
    useSlotAvailability(salonId, date, barberId);

  console.log('SLOT_PICKER_RENDER:', {
    salonId,
    date,
    barberId,
    selectedSlot,
    slotsCount: slots.length,
    availableCount,
    totalCount,
    loading,
    lastUpdated
  });

  // Group slots by time of day
  const groupSlots = (): SlotGroup[] => {
    const morning = [];
    const afternoon = [];
    const evening = [];

    for (const slot of slots) {
      const hour = parseInt(slot.timeValue.split(":")[0]);
      if (hour < 12) {
        morning.push(slot);
      } else if (hour < 17) {
        afternoon.push(slot);
      } else {
        evening.push(slot);
      }
    }

    return [
      { label: "Morning", icon: Sunrise, slots: morning },
      { label: "Afternoon", icon: Sun, slots: afternoon },
      { label: "Evening", icon: Sunset, slots: evening },
    ];
  };

  const getGroupAvailability = (groupSlots: any[]) => {
    if (groupSlots.length === 0) return { available: 0, total: 0 };
    const available = groupSlots.filter((s) => s.available).length;
    return { available, total: groupSlots.length };
  };

  // Check if fully booked
  const isFullyBooked = availableCount === 0 && totalCount > 0;

  // Seconds ago helper
  const getTimeAgo = () => {
    if (!lastUpdated) return "never";
    const seconds = Math.floor(
      (new Date().getTime() - lastUpdated.getTime()) / 1000
    );
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h`;
  };

  if (!date) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <Calendar className="mx-auto mb-3 h-10 w-10 opacity-50" aria-hidden="true" />
        <p className="text-sm">Select a date to view available slots</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center sm:p-8">
        <p className="mb-4 text-sm font-medium text-muted-foreground">Checking available times…</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="h-11 animate-pulse rounded-xl bg-muted"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center sm:p-8" role="alert">
        <AlertCircle className="mx-auto mb-3 h-8 w-8 text-destructive" aria-hidden="true" />
        <p className="mb-1 text-sm font-semibold text-foreground">{error}</p>
        <p className="mb-4 text-xs text-muted-foreground">
          We couldn&apos;t confirm which slots are free, so booking is paused here for safety.
        </p>
        <button
          type="button"
          onClick={() => refresh()}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-primary/40"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Try again
        </button>
      </div>
    );
  }

  const groups = groupSlots();

  return (
    <div className="space-y-5">
      {/* Header with availability counter */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3.5">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            {availableCount}/{totalCount} slots available · Updated {getTimeAgo()} ago
          </p>
        </div>

        {/* Refresh button */}
        <button
          type="button"
          onClick={() => refresh()}
          disabled={loading}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border transition-colors hover:border-primary/40 disabled:opacity-50"
          title="Refresh availability"
          aria-label="Refresh availability"
        >
          <RotateCcw
            className={`h-4 w-4 text-muted-foreground ${loading ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
        </button>
      </div>

      {/* Holiday closed state */}
      {holidayInfo ? (
        <div className="rounded-2xl border border-border bg-card px-4 py-10 text-center">
          <Lock className="mx-auto mb-3 h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <h3 className="mb-1 font-display text-lg font-bold text-foreground">{holidayInfo.name}</h3>
          <p className="mb-4 text-sm text-muted-foreground">{holidayInfo.note || "Salon is closed on this day"}</p>
          <span className="inline-flex items-center rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-foreground">
            Please select another date
          </span>
        </div>
      ) : isFullyBooked ? (
        <div className="rounded-2xl border border-border bg-card px-4 py-10 text-center">
          <Calendar className="mx-auto mb-3 h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="mb-1 text-sm font-semibold text-foreground">No slots available</p>
          <p className="text-xs text-muted-foreground">Try selecting a different date or barber</p>
        </div>
      ) : (
        <>
          {/* Time slot groups */}
          <div className="space-y-5">
            {groups.map(
              (group) =>
                group.slots.length > 0 && (
                  <div key={group.label}>
                    <div className="mb-2.5 flex items-center justify-between gap-2">
                      <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                        <group.icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        {group.label}
                      </p>
                      <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                        {getGroupAvailability(group.slots).available}/
                        {getGroupAvailability(group.slots).total}
                      </span>
                    </div>

                    {/* Slot grid */}
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                      {group.slots.map((slot) => (
                        <button
                          key={slot.timeValue}
                          type="button"
                          onClick={() =>
                            slot.available &&
                            onSlotSelect(slot.timeValue, slot.time)
                          }
                          disabled={!slot.available}
                          aria-pressed={selectedSlot === slot.timeValue}
                          aria-label={`${slot.time}${slot.available ? "" : " (unavailable)"}`}
                          className={`relative min-h-[44px] rounded-xl border px-2 py-2.5 text-xs font-medium transition-colors sm:text-sm ${
                            selectedSlot === slot.timeValue
                              ? "border-primary bg-primary text-primary-foreground"
                              : slot.available
                                ? "border-border bg-card text-foreground hover:border-primary/40"
                                : "cursor-not-allowed border-border bg-muted text-muted-foreground/50 line-through"
                          }`}
                        >
                          {selectedSlot === slot.timeValue && (
                            <span
                              aria-hidden="true"
                              className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-card text-primary"
                            >
                              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </span>
                          )}
                          {slot.time}
                        </button>
                      ))}
                    </div>
                  </div>
                )
            )}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 border-t border-border pt-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded border border-border bg-card" />
              <span>Available</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded bg-primary" />
              <span>Selected</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded border border-border bg-muted" />
              <span>Booked</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

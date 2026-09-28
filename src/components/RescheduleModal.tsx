import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, Calendar, Clock, Scissors, User, AlertCircle, RotateCcw, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { publicSupabase } from "@/integrations/supabase/publicClient";
import { useSlotAvailability } from "@/hooks/useSlotAvailability";
import {
  SLOT_BLOCKING_STATUSES,
  buildRescheduleDates,
  addDaysISO,
  formatISODate,
  formatTimeLabel,
  getISTDateISO,
  overlapsExisting,
  sameSlotTime,
  RESCHEDULE_WINDOW_DAYS,
  type OccupiedInterval,
  type RescheduleResult,
} from "@/lib/reschedule";

export interface RescheduleModalBooking {
  id: string;
  salon_id: string;
  stylist_id?: string | null;
  salon_name?: string;
  service_name?: string;
  stylist_name?: string | null;
  service_duration?: number | null;
  current_date?: string | null;
  current_time?: string | null;
}

interface RescheduleModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (newDate: string, newTime: string) => Promise<RescheduleResult>;
  booking?: RescheduleModalBooking | null;
  isLoading?: boolean;
}

export function RescheduleModal({ open, onClose, onConfirm, booking, isLoading }: RescheduleModalProps) {
  const [todayISO, setTodayISO] = useState(() => getISTDateISO());
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [closedDates, setClosedDates] = useState<Set<string>>(new Set());
  const [occupied, setOccupied] = useState<OccupiedInterval[]>([]);
  const [occupiedError, setOccupiedError] = useState<string | null>(null);
  const [occupiedLoading, setOccupiedLoading] = useState(false);
  const selectedDateRef = useRef<HTMLButtonElement | null>(null);
  // The sheet is opened programmatically (no DialogTrigger), so Radix has no
  // trigger to return focus to — remember whatever opened it instead.
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const bookingId = booking?.id || "";
  const salonId = booking?.salon_id || "";
  const stylistId = booking?.stylist_id || undefined;
  const duration = booking?.service_duration || 30;

  const dates = useMemo(() => buildRescheduleDates(todayISO), [todayISO]);

  // Reset every time the sheet opens for a booking. Pre-select the booking's
  // current date when it's still bookable so the customer sees that day's
  // real slots straight away.
  useEffect(() => {
    if (!open) return;
    const today = getISTDateISO();
    setTodayISO(today);
    const current = booking?.current_date || "";
    const inWindow = current >= today && current <= addDaysISO(today, RESCHEDULE_WINDOW_DAYS);
    setSelectedDate(inWindow ? current : "");
    setSelectedTime("");
    setSubmitError(null);
  }, [open, booking?.id, booking?.current_date]);

  // Salon closed dates (salon_holidays) across the whole window, in one query.
  useEffect(() => {
    if (!open || !salonId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await publicSupabase
        .from("salon_holidays")
        .select("date")
        .eq("salon_id", salonId)
        .gte("date", todayISO)
        .lte("date", addDaysISO(todayISO, RESCHEDULE_WINDOW_DAYS));
      if (cancelled) return;
      // A failed lookup only loses the "Closed" hint on the date strip:
      // useSlotAvailability re-checks the chosen day and the server rejects
      // closed days, so nothing becomes bookable by mistake.
      if (error) return;
      setClosedDates(new Set((data || []).map((row) => String(row.date).slice(0, 10))));
    })();
    return () => {
      cancelled = true;
    };
  }, [open, salonId, todayISO]);

  const { slots, loading: slotsLoading, error: slotsError, holidayInfo, lastUpdated, refresh } = useSlotAvailability(
    open ? salonId : "",
    open ? selectedDate : "",
    stylistId,
  );

  // useSlotAvailability matches bookings by exact slot start. This adds the
  // service-duration overlap check (other bookings of the same stylist, never
  // this booking itself) so a slot that would run into the next booking isn't
  // offered — the server applies the identical rule.
  const loadOccupied = useCallback(async () => {
    if (!open || !salonId || !stylistId || !selectedDate) {
      setOccupied([]);
      setOccupiedError(null);
      return;
    }
    setOccupiedLoading(true);
    const { data, error } = await supabase
      .from("bookings")
      .select("id, booking_time, services (duration)")
      .eq("salon_id", salonId)
      .eq("stylist_id", stylistId)
      .eq("booking_date", selectedDate)
      .neq("id", bookingId)
      .in("status", SLOT_BLOCKING_STATUSES);
    setOccupiedLoading(false);
    if (error) {
      setOccupied([]);
      setOccupiedError("Could not check slot availability. Please try again.");
      return;
    }
    setOccupiedError(null);
    setOccupied(
      (data || []).map((row) => ({
        id: row.id,
        booking_time: row.booking_time,
        duration: row.services?.duration ?? null,
      })),
    );
  }, [open, salonId, stylistId, selectedDate, bookingId]);

  useEffect(() => {
    loadOccupied();
    // lastUpdated changes whenever useSlotAvailability refetches (including
    // its realtime refresh), keeping both sources in step.
  }, [loadOccupied, lastUpdated]);

  useEffect(() => {
    if (!open) return;
    selectedDateRef.current?.scrollIntoView?.({ block: "nearest", inline: "center" });
  }, [open, selectedDate]);

  const isCurrentSlot = useCallback(
    (timeValue: string) => selectedDate === booking?.current_date && sameSlotTime(timeValue, booking?.current_time),
    [selectedDate, booking?.current_date, booking?.current_time],
  );

  const timeOptions = useMemo(
    () =>
      slots.map((slot) => {
        const current = isCurrentSlot(slot.timeValue);
        const available =
          slot.available && !current && !overlapsExisting(slot.timeValue, duration, occupied, bookingId);
        return { ...slot, current, available };
      }),
    [slots, isCurrentSlot, duration, occupied, bookingId],
  );

  const availableCount = timeOptions.filter((slot) => slot.available).length;
  const availabilityError = slotsError || occupiedError;
  const checkingSlots = slotsLoading || occupiedLoading;
  const selectionStillValid = timeOptions.some((slot) => slot.timeValue === selectedTime && slot.available);

  // If realtime marks the chosen slot as taken, drop it rather than letting
  // the customer confirm a slot that's visibly gone.
  useEffect(() => {
    if (selectedTime && !checkingSlots && timeOptions.length > 0 && !selectionStillValid) {
      setSelectedTime("");
      setSubmitError("That slot was just taken. Please choose another time.");
    }
  }, [selectedTime, checkingSlots, timeOptions.length, selectionStillValid]);

  if (!booking) return null;

  const handleOpenChange = (next: boolean) => {
    if (!next && !isLoading) onClose();
  };

  const handleDateSelect = (date: string) => {
    if (date === selectedDate) return;
    setSelectedDate(date);
    setSelectedTime("");
    setSubmitError(null);
  };

  const handleConfirm = async () => {
    if (!selectedDate || !selectedTime || isLoading) return;
    setSubmitError(null);
    const result = await onConfirm(selectedDate, selectedTime);
    if (result.ok === true) return;
    setSubmitError(result.message);
    if (result.reason === "slot_unavailable" || result.reason === "invalid_selection") {
      setSelectedTime("");
      refresh();
      loadOccupied();
    }
  };

  const currentDateLabel = booking.current_date
    ? formatISODate(booking.current_date, { weekday: "short", day: "numeric", month: "short" })
    : "Date not set";
  const currentTimeLabel = booking.current_time ? formatTimeLabel(booking.current_time) : "Time not set";
  const canConfirm = Boolean(selectedDate && selectedTime && selectionStillValid) && !isLoading && !checkingSlots;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          data-testid="reschedule-overlay"
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-150 sm:items-center sm:p-6"
        >
          <DialogPrimitive.Content
            aria-describedby="reschedule-description"
            onOpenAutoFocus={(event) => {
              returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
              // Focus the dialog itself (announced via its title) rather than
              // the close button; Tab then moves into the controls.
              event.preventDefault();
              (event.currentTarget as HTMLElement | null)?.focus();
            }}
            onCloseAutoFocus={(event) => {
              const target = returnFocusRef.current;
              if (target?.isConnected) {
                event.preventDefault();
                target.focus();
              }
            }}
            onEscapeKeyDown={(event) => isLoading && event.preventDefault()}
            onPointerDownOutside={(event) => isLoading && event.preventDefault()}
            className="reschedule-sheet relative flex w-full flex-col overflow-hidden rounded-t-3xl border border-border bg-background text-foreground shadow-2xl outline-none duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-bottom-8 data-[state=closed]:slide-out-to-bottom-8 data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 sm:max-w-lg sm:rounded-3xl sm:data-[state=open]:slide-in-from-bottom-2 sm:data-[state=closed]:slide-out-to-bottom-2"
          >
            {/* Header — stays put while the body scrolls */}
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 pb-3 pt-3 sm:pt-5">
              <div className="min-w-0">
                <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-muted sm:hidden" aria-hidden="true" />
                <DialogPrimitive.Title className="font-display text-lg font-bold">Reschedule booking</DialogPrimitive.Title>
                <DialogPrimitive.Description id="reschedule-description" className="truncate text-sm text-muted-foreground">
                  {booking.salon_name || "Salon"}
                </DialogPrimitive.Description>
              </div>
              <DialogPrimitive.Close
                disabled={isLoading}
                aria-label="Close reschedule"
                className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </DialogPrimitive.Close>
            </div>

            {/* Body — the only scrolling region */}
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-4">
              <section aria-labelledby="reschedule-current" className="rounded-2xl border border-border bg-muted/40 p-4">
                <h3 id="reschedule-current" className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Current booking
                </h3>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    <Calendar className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    <dt className="sr-only">Date</dt>
                    <dd className="truncate font-medium" data-testid="current-date">{currentDateLabel}</dd>
                  </div>
                  <div className="flex min-w-0 items-center gap-2">
                    <Clock className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    <dt className="sr-only">Time</dt>
                    <dd className="truncate font-medium" data-testid="current-time">{currentTimeLabel}</dd>
                  </div>
                  {booking.service_name && (
                    <div className="flex min-w-0 items-center gap-2">
                      <Scissors className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <dt className="sr-only">Service</dt>
                      <dd className="truncate text-muted-foreground">{booking.service_name}</dd>
                    </div>
                  )}
                  {booking.stylist_name && (
                    <div className="flex min-w-0 items-center gap-2">
                      <User className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <dt className="sr-only">Stylist</dt>
                      <dd className="truncate text-muted-foreground">{booking.stylist_name}</dd>
                    </div>
                  )}
                </dl>
              </section>

              <section aria-labelledby="reschedule-date">
                <h3 id="reschedule-date" className="mb-2 text-sm font-semibold">Choose date</h3>
                <div
                  role="group"
                  aria-labelledby="reschedule-date"
                  className="-mx-5 flex snap-x gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {dates.map((date) => {
                    const closed = closedDates.has(date);
                    const selected = date === selectedDate;
                    return (
                      <button
                        key={date}
                        ref={selected ? selectedDateRef : undefined}
                        type="button"
                        disabled={closed || isLoading}
                        aria-pressed={selected}
                        aria-label={`${formatISODate(date, { weekday: "long", day: "numeric", month: "long" })}${closed ? ", salon closed" : ""}`}
                        onClick={() => handleDateSelect(date)}
                        className={cn(
                          "flex min-h-[64px] w-16 shrink-0 snap-start flex-col items-center justify-center rounded-2xl border text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card hover:border-primary/40",
                          closed && "cursor-not-allowed opacity-45",
                        )}
                      >
                        <span className="text-[11px] font-medium uppercase">
                          {date === todayISO ? "Today" : formatISODate(date, { weekday: "short" })}
                        </span>
                        <span className="text-lg font-bold leading-tight">{formatISODate(date, { day: "numeric" })}</span>
                        <span className="text-[11px]">{closed ? "Closed" : formatISODate(date, { month: "short" })}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section aria-labelledby="reschedule-time" aria-busy={checkingSlots}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 id="reschedule-time" className="text-sm font-semibold">Choose time</h3>
                  {selectedDate && !checkingSlots && !availabilityError && !holidayInfo && timeOptions.length > 0 && (
                    <span className="text-xs text-muted-foreground">{availableCount} available</span>
                  )}
                </div>

                {!selectedDate ? (
                  <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                    Select a date to see available times
                  </p>
                ) : checkingSlots ? (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label="Checking available times">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div key={i} className="h-11 animate-pulse rounded-xl bg-muted" />
                    ))}
                  </div>
                ) : availabilityError ? (
                  <div role="alert" className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-center">
                    <p className="text-sm font-medium">{availabilityError}</p>
                    <button
                      type="button"
                      onClick={() => {
                        refresh();
                        loadOccupied();
                      }}
                      className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold"
                    >
                      <RotateCcw className="h-4 w-4" aria-hidden="true" />
                      Try again
                    </button>
                  </div>
                ) : holidayInfo ? (
                  <p className="rounded-2xl border border-border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
                    The salon is closed on this day{holidayInfo.name ? ` (${holidayInfo.name})` : ""}. Please pick another date.
                  </p>
                ) : availableCount === 0 ? (
                  <p className="rounded-2xl border border-border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
                    No free times left on this day. Please pick another date.
                  </p>
                ) : (
                  <div role="group" aria-labelledby="reschedule-time" className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {timeOptions.map((slot) => {
                      const selected = slot.timeValue === selectedTime;
                      const label = formatTimeLabel(slot.timeValue);
                      return (
                        <button
                          key={slot.timeValue}
                          type="button"
                          disabled={!slot.available || isLoading}
                          aria-pressed={selected}
                          aria-label={`${label}${slot.current ? ", your current slot" : !slot.available ? ", unavailable" : ""}`}
                          onClick={() => {
                            setSelectedTime(slot.timeValue);
                            setSubmitError(null);
                          }}
                          className={cn(
                            "flex min-h-[44px] flex-col items-center justify-center rounded-xl border px-1 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            selected
                              ? "border-primary bg-primary text-primary-foreground"
                              : slot.current
                                ? "cursor-not-allowed border-dashed border-primary/50 bg-primary/5 text-primary"
                                : slot.available
                                  ? "border-border bg-card hover:border-primary/40"
                                  : "cursor-not-allowed border-transparent bg-muted/60 text-muted-foreground line-through",
                          )}
                        >
                          <span>{label}</span>
                          {slot.current && <span className="text-[10px] font-medium">Current</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              {submitError && (
                <div role="alert" className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
                  <span>{submitError}</span>
                </div>
              )}
            </div>

            {/* Footer — always reachable, clears the home indicator */}
            <div className="shrink-0 space-y-3 border-t border-border bg-background px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-5">
              {selectedDate && selectedTime && (
                <p className="flex items-center gap-2 text-sm" aria-live="polite">
                  <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>
                    <span className="font-semibold">New:</span>{" "}
                    {formatISODate(selectedDate, { weekday: "short", day: "numeric", month: "short" })} at{" "}
                    {formatTimeLabel(selectedTime)}
                  </span>
                </p>
              )}
              <div className="flex gap-3">
                <Button variant="outline" className="h-11 flex-1 rounded-full" onClick={onClose} disabled={isLoading}>
                  Cancel
                </Button>
                <Button className="h-11 flex-1 rounded-full" onClick={handleConfirm} disabled={!canConfirm}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                      Rescheduling…
                    </>
                  ) : (
                    "Confirm reschedule"
                  )}
                </Button>
              </div>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Overlay>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

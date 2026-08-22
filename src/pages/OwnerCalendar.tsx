import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Clock, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { OwnerShell } from "@/components/dashboard/OwnerShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/design/Skeleton";
import { formatINR } from "@/lib/currency";
import { toast } from "sonner";

type OwnerRecord = {
  id: string;
  name: string;
  email: string;
};

type SalonRow = {
  id: string;
  name: string;
};

type BookingItem = {
  id: string;
  booking_date: string;
  booking_time: string | null;
  status: string;
  customer_name: string;
  service_name: string;
  service_price: number | null;
  barber_name: string | null;
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_ORDER = ["waiting", "in_progress", "completed", "cancelled"] as const;

const formatStatus = (value: string) =>
  value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const statusToneClass: Record<string, string> = {
  waiting: "border-warning/20 bg-warning/10 text-warning",
  pending: "border-warning/20 bg-warning/10 text-warning",
  accepted: "border-primary/20 bg-primary/10 text-primary",
  in_progress: "border-primary/20 bg-primary/10 text-primary",
  completed: "border-success/20 bg-success/10 text-success",
  cancelled: "border-destructive/20 bg-destructive/10 text-destructive",
  rejected: "border-destructive/20 bg-destructive/10 text-destructive",
};

const statusDotClass: Record<string, string> = {
  waiting: "bg-warning",
  pending: "bg-warning",
  accepted: "bg-primary",
  in_progress: "bg-primary",
  completed: "bg-success",
  cancelled: "bg-destructive",
  rejected: "bg-destructive",
};

const pad2 = (value: number) => String(value).padStart(2, "0");
const toISODate = (date: Date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
const todayISO = () => toISODate(new Date());

const formatTime = (time: string | null) => {
  if (!time) return "--";
  const [hoursRaw, minutesRaw] = time.split(":");
  const hours = Number(hoursRaw);
  if (Number.isNaN(hours)) return time;
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHour}:${minutesRaw ?? "00"} ${period}`;
};

const normalizeBooking = (row: any): BookingItem => {
  const firstName = row.customer_profiles?.first_name?.trim?.() || "";
  const lastName = row.customer_profiles?.last_name?.trim?.() || "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  return {
    id: row.id,
    booking_date: row.booking_date,
    booking_time: row.booking_time ?? null,
    status: row.status || "waiting",
    customer_name: fullName || "Customer",
    service_name: row.services?.name || "Service",
    service_price: typeof row.services?.price === "number" ? row.services.price : null,
    barber_name: row.barbers?.name || null,
  };
};

type CalendarCell = { date: Date; iso: string } | null;

export default function OwnerCalendar() {
  const navigate = useNavigate();
  const supabaseAny = supabase as any;

  const [loading, setLoading] = useState(true);
  const [monthLoading, setMonthLoading] = useState(false);
  const [owner, setOwner] = useState<OwnerRecord | null>(null);
  const [salon, setSalon] = useState<SalonRow | null>(null);
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleLogout = useCallback(() => {
    localStorage.removeItem("owner");
    navigate("/owner-login", { replace: true });
  }, [navigate]);

  const fetchMonthBookings = useCallback(async (salonId: string, cursor: Date) => {
    setMonthLoading(true);
    const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);

    const { data, error } = await supabaseAny
      .from("bookings")
      .select(`
        id,
        booking_date,
        booking_time,
        status,
        customer_id,
        service_id,
        stylist_id,
        customer_profiles!fk_bookings_customer_profile(first_name, last_name),
        services(name, price),
        barbers!bookings_stylist_id_fkey(name)
      `)
      .eq("salon_id", salonId)
      .gte("booking_date", toISODate(monthStart))
      .lte("booking_date", toISODate(monthEnd))
      .order("booking_date", { ascending: true })
      .order("booking_time", { ascending: true });

    setMonthLoading(false);

    if (error) {
      console.error("CALENDAR_FETCH_ERROR", error.message);
      toast.error(error.message || "Failed to load bookings");
      return;
    }

    setBookings(((data || []) as any[]).map(normalizeBooking));
  }, [supabaseAny]);

  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true);
      const raw = localStorage.getItem("owner");
      if (!raw) {
        navigate("/owner-login", { replace: true });
        return;
      }

      try {
        const parsed = JSON.parse(raw) as OwnerRecord;
        setOwner(parsed);

        const { data: salonData, error: salonError } = await supabaseAny
          .from("salons")
          .select("id, name")
          .eq("owner_id", parsed.id)
          .maybeSingle();

        if (salonError) throw salonError;

        setSalon((salonData as SalonRow) || null);
      } catch (error) {
        console.error("CALENDAR_BOOTSTRAP_ERROR", error);
        localStorage.removeItem("owner");
        navigate("/owner-login", { replace: true });
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, [navigate, supabaseAny]);

  useEffect(() => {
    if (!salon?.id) return;
    fetchMonthBookings(salon.id, monthCursor);
  }, [salon?.id, monthCursor, fetchMonthBookings]);

  const bookingsByDate = useMemo(() => {
    const map = new Map<string, BookingItem[]>();
    bookings.forEach((booking) => {
      const list = map.get(booking.booking_date) || [];
      list.push(booking);
      map.set(booking.booking_date, list);
    });
    return map;
  }, [bookings]);

  const gridCells = useMemo<CalendarCell[]>(() => {
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const leading = firstDay.getDay();
    const totalCells = Math.ceil((leading + daysInMonth) / 7) * 7;

    const cells: CalendarCell[] = [];
    for (let i = 0; i < totalCells; i += 1) {
      const dayNumber = i - leading + 1;
      if (dayNumber < 1 || dayNumber > daysInMonth) {
        cells.push(null);
      } else {
        const date = new Date(year, month, dayNumber);
        cells.push({ date, iso: toISODate(date) });
      }
    }
    return cells;
  }, [monthCursor]);

  const goToPrevMonth = () => setMonthCursor((cursor) => new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
  const goToNextMonth = () => setMonthCursor((cursor) => new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));
  const goToToday = () => {
    const now = new Date();
    setMonthCursor(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  const openDay = (iso: string) => {
    setSelectedDate(iso);
    setSheetOpen(true);
  };

  const selectedDayBookings = useMemo(() => {
    if (!selectedDate) return [];
    return (bookingsByDate.get(selectedDate) || [])
      .slice()
      .sort((a, b) => (a.booking_time || "").localeCompare(b.booking_time || ""));
  }, [selectedDate, bookingsByDate]);

  const totalThisMonth = bookings.length;

  if (loading) {
    return (
      <OwnerShell onLogout={handleLogout}>
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-elevation-1">
            <Skeleton width={200} height={32} />
            <div className="mt-3">
              <Skeleton width={280} height={16} />
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-elevation-1">
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 35 }).map((_, index) => (
                <Skeleton key={index} height={96} borderRadius={12} />
              ))}
            </div>
          </div>
        </div>
      </OwnerShell>
    );
  }

  if (!owner || !salon) return null;

  return (
    <OwnerShell onLogout={handleLogout}>
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-2xl border border-border bg-card p-6 shadow-elevation-1">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">Calendar</h1>
              <p className="mt-1 text-sm text-muted-foreground">Real bookings for {salon.name}, by day.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={goToToday}>
                Today
              </Button>
              <div className="flex items-center gap-1 rounded-xl border border-border bg-muted/40 p-1">
                <button
                  type="button"
                  onClick={goToPrevMonth}
                  className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="min-w-[140px] px-2 text-center font-display text-sm font-bold text-foreground">
                  {monthCursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
                </span>
                <button
                  type="button"
                  onClick={goToNextMonth}
                  className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
                  aria-label="Next month"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="rounded-full bg-muted/60 px-3 py-1 font-mono font-semibold text-foreground">
              {totalThisMonth} booking{totalThisMonth === 1 ? "" : "s"} this month
            </span>
            {STATUS_ORDER.map((status) => (
              <span key={status} className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${statusDotClass[status]}`} />
                {formatStatus(status)}
              </span>
            ))}
          </div>
        </section>

        <Card className="rounded-2xl border-border bg-card shadow-elevation-1">
          <CardContent className="p-6">
            {monthLoading ? (
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: 35 }).map((_, index) => (
                  <Skeleton key={index} height={96} borderRadius={12} />
                ))}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-7 gap-2 pb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {WEEKDAY_LABELS.map((label) => (
                    <div key={label} className="text-center">
                      {label}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {gridCells.map((cell, index) => {
                    if (!cell) {
                      return <div key={`blank-${index}`} className="min-h-[96px] rounded-xl border border-transparent" />;
                    }

                    const dayBookings = bookingsByDate.get(cell.iso) || [];
                    const isToday = cell.iso === todayISO();
                    const isSelected = cell.iso === selectedDate;
                    const statusCounts = dayBookings.reduce<Record<string, number>>((acc, booking) => {
                      acc[booking.status] = (acc[booking.status] || 0) + 1;
                      return acc;
                    }, {});

                    return (
                      <button
                        key={cell.iso}
                        type="button"
                        onClick={() => openDay(cell.iso)}
                        className={`flex min-h-[96px] flex-col items-start gap-1.5 rounded-xl border p-2.5 text-left transition-colors ${
                          isSelected
                            ? "border-primary bg-primary/5"
                            : isToday
                            ? "border-primary/40 bg-primary/5"
                            : "border-border bg-background/60 hover:bg-muted/40"
                        }`}
                      >
                        <div className="flex w-full items-center justify-between">
                          <span className={`font-mono text-sm font-semibold ${isToday ? "text-primary" : "text-foreground"}`}>
                            {cell.date.getDate()}
                          </span>
                          {dayBookings.length > 0 ? (
                            <span className="rounded-full bg-muted px-1.5 py-0.5 font-mono text-[10px] font-bold text-foreground">
                              {dayBookings.length}
                            </span>
                          ) : null}
                        </div>
                        {dayBookings.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(statusCounts).map(([status, count]) => (
                              <span key={status} className="flex items-center gap-1">
                                {Array.from({ length: Math.min(count, 4) }).map((_, dotIndex) => (
                                  <span
                                    key={dotIndex}
                                    className={`h-1.5 w-1.5 rounded-full ${statusDotClass[status] ?? "bg-muted-foreground"}`}
                                  />
                                ))}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                {totalThisMonth === 0 ? (
                  <div className="mt-6 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    No bookings scheduled this month.
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="font-display text-2xl font-bold text-foreground">
              {selectedDate
                ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-IN", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })
                : "Bookings"}
            </SheetTitle>
            <SheetDescription>
              {selectedDayBookings.length} booking{selectedDayBookings.length === 1 ? "" : "s"} on this day
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-3">
            {selectedDayBookings.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No bookings on this day.
              </div>
            ) : (
              selectedDayBookings.map((booking) => {
                const tone = statusToneClass[booking.status] ?? "border-transparent bg-muted text-muted-foreground";
                return (
                  <div key={booking.id} className="rounded-xl border border-border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-foreground">{booking.customer_name}</p>
                        <p className="text-sm text-muted-foreground">{booking.service_name}</p>
                      </div>
                      <Badge variant="outline" className={`rounded-full capitalize ${tone}`}>
                        {formatStatus(booking.status)}
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {formatTime(booking.booking_time)}
                      </span>
                      {booking.barber_name ? (
                        <span className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5" />
                          {booking.barber_name}
                        </span>
                      ) : null}
                      {booking.service_price !== null ? (
                        <span className="font-semibold text-foreground">{formatINR(booking.service_price)}</span>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </SheetContent>
      </Sheet>
    </OwnerShell>
  );
}

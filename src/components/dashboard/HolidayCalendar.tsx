import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

type HolidayType = "national" | "festival" | "custom";

type Holiday = {
  id: string;
  date: string;
  name: string;
  type: HolidayType;
  note?: string | null;
};

type Booking = {
  id: string;
  booking_date: string | null;
  created_at?: string | null;
  time_slot: string | null;
  status: string | null;
  customer_first_name?: string | null;
  customer_last_name?: string | null;
  customer_phone?: string | null;
  services?: { name?: string | null } | null;
  barbers?: { name?: string | null } | null;
};

type HolidayCalendarProps = {
  salonId: string;
};

const typeBadgeClass: Record<HolidayType, string> = {
  national: "bg-indigo-100 text-indigo-700",
  festival: "bg-amber-100 text-amber-700",
  custom: "bg-slate-100 text-slate-700",
};

const nationalSuggestions = (year: number) => [
  {
    date: `${year}-01-26`,
    name: "Republic Day",
    type: "national" as HolidayType,
    note: "Closed for Republic Day",
  },
  {
    date: `${year}-08-15`,
    name: "Independence Day",
    type: "national" as HolidayType,
    note: "Closed for Independence Day",
  },
  {
    date: `${year}-10-02`,
    name: "Gandhi Jayanti",
    type: "national" as HolidayType,
    note: "Closed for Gandhi Jayanti",
  },
];

const toMonthLabel = (date: Date) =>
  date.toLocaleString("en-IN", { month: "long", year: "numeric" });

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const endOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);

const dateToISO = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export function HolidayCalendar({ salonId }: HolidayCalendarProps) {
  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [openAdd, setOpenAdd] = useState(false);
  const [saving, setSaving] = useState(false);

  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<HolidayType>("custom");
  const [note, setNote] = useState("");

  const monthStart = startOfMonth(monthCursor);
  const monthEnd = endOfMonth(monthCursor);

  const getEffectiveBookingDate = (booking: Booking) => {
    if (booking.booking_date) return booking.booking_date;
    if (booking.created_at) return booking.created_at.slice(0, 10);
    return null;
  };

  const formatTime = (timeSlot?: string | null) => {
    if (!timeSlot) return "";
    const [h, m] = timeSlot.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${hour}:${String(m).padStart(2, "0")} ${period}`;
  };

  const fetchHolidays = async () => {
    if (!salonId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("salon_holidays" as any)
        .select("id, date, name, type, note")
        .eq("salon_id", salonId)
        .gte("date", dateToISO(new Date(monthStart.getFullYear(), monthStart.getMonth(), 1)))
        .lte("date", dateToISO(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 31)))
        .order("date", { ascending: true });

      if (error) throw error;
      setHolidays((data || []) as Holiday[]);
    } catch (error: any) {
      toast.error(error.message || "Failed to load holidays");
    } finally {
      setLoading(false);
    }
  };

  const fetchBookings = async () => {
    if (!salonId) return;
    setBookingsLoading(true);
    try {
      const monthStartIso = dateToISO(new Date(monthStart.getFullYear(), monthStart.getMonth(), 1));
      const monthEndIso = dateToISO(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 31));
      const createdStartIso = `${monthStartIso}T00:00:00.000Z`;
      const createdEndIso = `${monthEndIso}T23:59:59.999Z`;

      const [scheduledRes, walkInRes] = await Promise.all([
        supabase
          .from("queue")
          .select(
            "id, booking_date, created_at, time_slot, status, customer_first_name, customer_last_name, customer_phone, services(name), barbers(name)"
          )
          .eq("salon_id", salonId)
          .gte("booking_date", monthStartIso)
          .lte("booking_date", monthEndIso)
          .order("time_slot", { ascending: true }),
        supabase
          .from("queue")
          .select(
            "id, booking_date, created_at, time_slot, status, customer_first_name, customer_last_name, customer_phone, services(name), barbers(name)"
          )
          .eq("salon_id", salonId)
          .is("booking_date", null)
          .gte("created_at", createdStartIso)
          .lte("created_at", createdEndIso)
          .order("created_at", { ascending: true }),
      ]);

      if (scheduledRes.error) throw scheduledRes.error;
      if (walkInRes.error) throw walkInRes.error;

      const merged = [...(scheduledRes.data || []), ...(walkInRes.data || [])] as Booking[];
      const uniqueById = Array.from(new Map(merged.map((item) => [item.id, item])).values());
      setBookings(uniqueById);
    } catch (error: any) {
      toast.error(error.message || "Failed to load bookings");
    } finally {
      setBookingsLoading(false);
    }
  };

  useEffect(() => {
    fetchHolidays();
    fetchBookings();
  }, [salonId, monthCursor]);

  const holidayMap = useMemo(() => {
    const map = new Map<string, Holiday>();
    holidays.forEach((h) => map.set(h.date, h));
    return map;
  }, [holidays]);

  const bookingsByDate = useMemo(() => {
    const map = new Map<string, Booking[]>();
    bookings.forEach((b) => {
      const effectiveDate = getEffectiveBookingDate(b);
      if (!effectiveDate) return;
      const existing = map.get(effectiveDate) || [];
      existing.push(b);
      map.set(effectiveDate, existing);
    });
    return map;
  }, [bookings]);

  useEffect(() => {
    if (!salonId) return;

    const channel = supabase
      .channel(`dashboard-cal-${salonId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queue", filter: `salon_id=eq.${salonId}` },
        () => {
          fetchBookings();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "salon_holidays", filter: `salon_id=eq.${salonId}` },
        () => {
          fetchHolidays();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [salonId, monthCursor]);

  const selectedDateHoliday = selectedDate ? holidayMap.get(selectedDate) : undefined;
  const selectedDateBookings = selectedDate ? bookingsByDate.get(selectedDate) || [] : [];

  const monthCells = useMemo(() => {
    const firstWeekDay = monthStart.getDay();
    const totalDays = monthEnd.getDate();
    const cells: Array<{ iso: string; day: number; inMonth: boolean }> = [];

    for (let i = 0; i < firstWeekDay; i += 1) {
      cells.push({ iso: "", day: 0, inMonth: false });
    }

    for (let d = 1; d <= totalDays; d += 1) {
      const current = new Date(monthStart.getFullYear(), monthStart.getMonth(), d);
      cells.push({ iso: dateToISO(current), day: d, inMonth: true });
    }

    while (cells.length % 7 !== 0) {
      cells.push({ iso: "", day: 0, inMonth: false });
    }

    return cells;
  }, [monthStart, monthEnd]);

  const handleAddHoliday = async () => {
    if (!date || !name.trim()) {
      toast.error("Date and holiday name are required");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("salon_holidays" as any).upsert({
        salon_id: salonId,
        date,
        name: name.trim(),
        type,
        note: note.trim() || null,
      });

      if (error) throw error;

      toast.success("Holiday saved");
      setOpenAdd(false);
      setDate("");
      setName("");
      setType("custom");
      setNote("");
      fetchHolidays();
    } catch (error: any) {
      toast.error(error.message || "Failed to save holiday");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    try {
      const { error } = await supabase.from("salon_holidays" as any).delete().eq("id", id);
      if (error) throw error;
      setHolidays((prev) => prev.filter((h) => h.id !== id));
      toast.success("Holiday removed");
    } catch (error: any) {
      toast.error(error.message || "Failed to remove holiday");
    }
  };

  const applySuggestion = async (suggestion: {
    date: string;
    name: string;
    type: HolidayType;
    note: string;
  }) => {
    try {
      const { error } = await supabase.from("salon_holidays" as any).upsert({
        salon_id: salonId,
        ...suggestion,
      });
      if (error) throw error;
      toast.success(`${suggestion.name} added`);
      fetchHolidays();
    } catch (error: any) {
      toast.error(error.message || "Failed to add suggestion");
    }
  };

  return (
    <Card className="rounded-xl border border-[#e3e2e5] bg-white shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-xl font-bold">
            <CalendarDays className="h-5 w-5 text-purple-600" /> Holiday Calendar
          </CardTitle>
          <Dialog open={openAdd} onOpenChange={setOpenAdd}>
            <DialogTrigger asChild>
              <Button className="rounded-full h-9 px-4">
                <Plus className="h-4 w-4 mr-1" /> Add Holiday
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Holiday</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                <Input
                  placeholder="Holiday name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as HolidayType)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="custom">Custom</option>
                  <option value="festival">Festival</option>
                  <option value="national">National</option>
                </select>
                <Input
                  placeholder="Optional note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <Button className="w-full" disabled={saving} onClick={handleAddHoliday}>
                  {saving ? "Saving..." : "Save Holiday"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="flex items-center justify-between rounded-xl border border-[#eeedf0] p-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <p className="font-semibold">{toMonthLabel(monthCursor)}</p>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-[#6b6474]">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {monthCells.map((cell, idx) => {
            const holiday = cell.iso ? holidayMap.get(cell.iso) : undefined;
            const dayBookings = cell.iso ? bookingsByDate.get(cell.iso) || [] : [];
            const holidayClass = holiday
              ? holiday.type === "national"
                ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                : holiday.type === "festival"
                  ? "bg-amber-50 border-amber-200 text-amber-700"
                  : "bg-slate-50 border-slate-200 text-slate-700"
              : "bg-white border-[#eeedf0]";

            return (
              <button
                key={`${cell.iso}-${idx}`}
                type="button"
                onClick={() => (cell.iso ? setSelectedDate(cell.iso === selectedDate ? null : cell.iso) : null)}
                className={`h-16 rounded-lg border p-2 text-xs ${
                  cell.inMonth ? holidayClass : "bg-[#f8f7fa] border-transparent"
                } ${cell.inMonth ? "text-left" : "cursor-default"} ${selectedDate === cell.iso ? "ring-2 ring-purple-500" : ""}`}
              >
                {cell.inMonth ? (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold">{cell.day}</p>
                      {dayBookings.length > 0 ? (
                        <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold text-purple-700">
                          {dayBookings.length}
                        </span>
                      ) : null}
                    </div>
                    {holiday ? (
                      <p className="mt-1 line-clamp-2 text-[10px] font-medium">{holiday.name}</p>
                    ) : null}
                    {!holiday && dayBookings.length > 0 ? (
                      <p className="mt-1 text-[10px] font-medium text-purple-700">Bookings available</p>
                    ) : null}
                  </>
                ) : null}
              </button>
            );
          })}
        </div>

        {selectedDate ? (
          <div className="rounded-xl border border-[#eeedf0] p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-[#494551]">
                {new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-IN", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
              <Button variant="ghost" size="sm" onClick={() => setSelectedDate(null)}>
                Close
              </Button>
            </div>

            {selectedDateHoliday ? (
              <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-2">
                <p className="text-xs font-semibold text-amber-800">Holiday: {selectedDateHoliday.name}</p>
                <p className="text-xs text-amber-700">Salon closed for booking on this date.</p>
              </div>
            ) : null}

            {bookingsLoading ? (
              <p className="text-sm text-[#6b6474]">Loading bookings...</p>
            ) : selectedDateBookings.length === 0 ? (
              <p className="text-sm text-[#6b6474]">No bookings for this day.</p>
            ) : (
              <div className="space-y-2">
                {selectedDateBookings.map((booking) => {
                  const fullName = [booking.customer_first_name, booking.customer_last_name]
                    .filter(Boolean)
                    .join(" ")
                    .trim();
                  const customerName = fullName || booking.customer_phone || "Customer";
                  return (
                    <div key={booking.id} className="rounded-lg border border-[#eeedf0] p-2">
                      <p className="text-sm font-semibold text-[#494551]">{customerName}</p>
                      <p className="text-xs text-[#6b6474]">
                        {(booking.services as any)?.name || "Service"} • {formatTime(booking.time_slot)} • Barber: {(booking.barbers as any)?.name || "Any"}
                      </p>
                      <p className="mt-1 text-[11px] uppercase tracking-wide text-[#6b6474]">Status: {booking.status || "waiting"}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}

        <div>
          <p className="mb-2 text-sm font-semibold text-[#494551]">Quick National/Festival Suggestions</p>
          <div className="flex flex-wrap gap-2">
            {nationalSuggestions(monthCursor.getFullYear()).map((item) => (
              <Button
                key={item.date}
                variant="outline"
                className="rounded-full text-xs"
                onClick={() => applySuggestion(item)}
              >
                Add {item.name}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-[#494551]">Holiday List</p>
          {loading ? (
            <p className="text-sm text-[#6b6474]">Loading holidays...</p>
          ) : holidays.length === 0 ? (
            <p className="text-sm text-[#6b6474]">No holidays for this month.</p>
          ) : (
            <div className="space-y-2">
              {holidays.map((h) => (
                <div key={h.id} className="flex items-center justify-between rounded-lg border border-[#eeedf0] p-3">
                  <div>
                    <p className="text-sm font-semibold">{h.name}</p>
                    <p className="text-xs text-[#6b6474]">{h.date}</p>
                    {h.note ? <p className="text-xs text-[#6b6474]">{h.note}</p> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${typeBadgeClass[h.type]}`}>
                      {h.type}
                    </span>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteHoliday(h.id)}>
                      <Trash2 className="h-4 w-4 text-rose-600" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

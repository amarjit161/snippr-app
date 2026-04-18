import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X, Check, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface BookingCalendarProps {
  salonId: string;
}

export const BookingCalendar = ({ salonId }: BookingCalendarProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [bookings, setBookings] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthRange = useMemo(() => {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);

    const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const endDate = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;

    return { startDate, endDate };
  }, [month, year]);

  const fetchBookings = async () => {
    setLoading(true);

    const { data } = await supabase
      .from("queue")
      .select(`
        id, booking_date, time_slot, status,
        customer_first_name, customer_last_name, customer_phone,
        services(name, price),
        barbers(name)
      `)
      .eq("salon_id", salonId)
      .gte("booking_date", monthRange.startDate)
      .lte("booking_date", monthRange.endDate)
      .order("time_slot", { ascending: true });

    setBookings(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchBookings();
  }, [salonId, monthRange.startDate, monthRange.endDate]);

  const bookingsByDate: Record<string, any[]> = {};
  bookings.forEach((booking) => {
    if (!booking.booking_date) return;
    if (!bookingsByDate[booking.booking_date]) {
      bookingsByDate[booking.booking_date] = [];
    }
    bookingsByDate[booking.booking_date].push(booking);
  });

  const getDaysInMonth = () => new Date(year, month + 1, 0).getDate();
  const getFirstDay = () => new Date(year, month, 1).getDay();
  const todayStr = new Date().toISOString().split("T")[0];

  const formatTime = (timeSlot?: string | null) => {
    if (!timeSlot) return "";
    const [h, m] = timeSlot.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${hour}:${String(m).padStart(2, "0")} ${period}`;
  };

  const updateStatus = async (bookingId: string, status: string) => {
    await supabase.from("queue").update({ status } as any).eq("id", bookingId);
    await fetchBookings();
  };

  const selectedBookings = selectedDate ? bookingsByDate[selectedDate] || [] : [];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-gray-900">Booking Calendar</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
            className="p-2 rounded-xl hover:bg-gray-100"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="font-semibold text-gray-800 min-w-[140px] text-center">
            {currentDate.toLocaleString("en-IN", { month: "long", year: "numeric" })}
          </span>
          <button
            onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
            className="p-2 rounded-xl hover:bg-gray-100"
            aria-label="Next month"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 mb-2">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="text-center text-xs font-semibold text-gray-400 py-2">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: getFirstDay() }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {Array.from({ length: getDaysInMonth() }).map((_, i) => {
          const day = i + 1;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayBookings = bookingsByDate[dateStr] || [];
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;
          const isPast = dateStr < todayStr;

          return (
            <button
              key={day}
              onClick={() => setSelectedDate(isSelected ? null : dateStr)}
              className={[
                "relative aspect-square rounded-xl flex flex-col items-center justify-center text-sm font-medium transition-all",
                isSelected ? "bg-purple-600 text-white" : "",
                !isSelected && isToday ? "ring-2 ring-purple-500" : "",
                !isSelected && !isToday && isPast ? "opacity-50" : "",
                !isSelected && !isToday && !isPast ? "hover:bg-gray-50" : "",
              ].join(" ")}
            >
              <span>{day}</span>
              {dayBookings.length > 0 && (
                <>
                  <span
                    className={[
                      "text-[9px] font-bold px-1.5 py-0.5 rounded-full mt-0.5",
                      isSelected ? "bg-white text-purple-700" : "bg-purple-100 text-purple-700",
                    ].join(" ")}
                  >
                    {dayBookings.length}
                  </span>
                  <span
                    className={[
                      "absolute bottom-1 h-1.5 w-1.5 rounded-full",
                      isSelected ? "bg-white" : "bg-purple-500",
                    ].join(" ")}
                  />
                </>
              )}
            </button>
          );
        })}
      </div>

      {loading && <p className="mt-4 text-sm text-gray-500">Loading bookings...</p>}

      {selectedDate && (
        <div className="mt-6 border-t border-gray-100 pt-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-gray-900">
              {new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
              <span className="ml-2 text-sm font-normal text-gray-500">({selectedBookings.length} bookings)</span>
            </h4>
            <button onClick={() => setSelectedDate(null)} aria-label="Close selected day panel">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {selectedBookings.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">No bookings for this day</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {selectedBookings.map((booking) => {
                const isAdvance = booking.booking_date > todayStr;
                const fullName = [booking.customer_first_name, booking.customer_last_name].filter(Boolean).join(" ").trim();
                const name = fullName || booking.customer_phone || "Customer";

                return (
                  <div
                    key={booking.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100"
                  >
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-sm flex-shrink-0">
                      {name[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm truncate">{name}</p>
                      <p className="text-xs text-gray-500">
                        {booking.services?.name || "Service"} · {formatTime(booking.time_slot)}
                      </p>
                      <p className="text-xs text-gray-400">Barber: {booking.barbers?.name || "Any"}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span
                        className={[
                          "text-xs px-2 py-0.5 rounded-full font-medium",
                          booking.status === "waiting" ? "bg-amber-100 text-amber-700" : "",
                          booking.status === "confirmed" ? "bg-green-100 text-green-700" : "",
                          booking.status === "completed" ? "bg-gray-100 text-gray-500" : "",
                          !["waiting", "confirmed", "completed"].includes(booking.status)
                            ? "bg-red-100 text-red-600"
                            : "",
                        ].join(" ")}
                      >
                        {booking.status}
                      </span>

                      {booking.status === "waiting" && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => updateStatus(booking.id, "confirmed")}
                            className="p-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
                            title="Accept"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          {!isAdvance && (
                            <button
                              onClick={() => updateStatus(booking.id, "in_progress")}
                              className="p-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                              title="Start"
                            >
                              <Clock className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}

                      {booking.status === "confirmed" && !isAdvance && (
                        <button
                          onClick={() => updateStatus(booking.id, "completed")}
                          className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-lg"
                        >
                          Complete
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
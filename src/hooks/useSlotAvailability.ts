import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TimeSlot {
  time: string; // Display format "10:00 AM"
  timeValue: string; // Database format "10:00:00"
  available: boolean;
  bookedCount: number;
  totalBarbers: number;
}

interface UseSlotAvailabilityResult {
  slots: TimeSlot[];
  loading: boolean;
  availableCount: number;
  totalCount: number;
  holidayInfo: {
    name: string;
    note?: string;
    type: string;
  } | null;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
}

const FALLBACK_OPEN_TIME = "09:00";
const FALLBACK_CLOSE_TIME = "20:00";
const SLOT_DURATION_MINUTES = 30;

const parseTimeParts = (time: string | null | undefined, fallback: string): [number, number] => {
  const raw = (time || fallback).trim();
  const [h, m] = raw.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) {
    const [fh, fm] = fallback.split(":").map(Number);
    return [fh, fm];
  }
  return [h, m];
};

const formatTime = (hours: number, minutes: number): string => {
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return `${String(displayHours).padStart(2, " ")}:${String(minutes).padStart(2, "0")} ${period}`;
};

// Convert HH:MM to minutes
const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

// Generate time slots from startTime to endTime (HH:MM format)
const generateTimeSlots = (startTime: string, endTime: string): string[] => {
  const slots: string[] = [];
  let current = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);

  while (current < end) {
    const hours = Math.floor(current / 60);
    const minutes = current % 60;
    const timeValue = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
    slots.push(timeValue);
    current += SLOT_DURATION_MINUTES;
  }

  return slots;
};

// Convert 24h time to 12h display format
const formatTimeDisplay = (timeValue: string): string => {
  const [hours, minutes] = timeValue.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return `${String(displayHours).padStart(2, " ")}:${String(minutes).padStart(2, "0")} ${period}`;
};

export function useSlotAvailability(
  salonId: string,
  date: string, // YYYY-MM-DD format
  barberId?: string // Optional: if provided, check only this barber
): UseSlotAvailabilityResult {
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [holidayInfo, setHolidayInfo] = useState<{
    name: string;
    note?: string;
    type: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const requestSequenceRef = useRef(0);

  // Fetch available slots
  const fetchSlots = useCallback(async (selectedDate: string = date) => {
    const requestId = ++requestSequenceRef.current;

    if (!salonId || !selectedDate) {
      if (requestId !== requestSequenceRef.current) return;
      setSlots([]);
      setHolidayInfo(null);
      return;
    }

    setLoading(true);
    setHolidayInfo(null);
    setSlots([]);
    try {
      // Step 1/2: read salon hours and always apply fallback values.
      const { data: salon, error: salonError } = await supabase
        .from("salons" as any)
        .select("open_time, close_time, is_manual_closed")
        .eq("id", salonId)
        .maybeSingle();

      if (import.meta.env.DEV) console.log('SALON_FETCH:', { salonId, salon, error: salonError });
      if (import.meta.env.DEV) console.log('SALON_RAW_DATA:', JSON.stringify(salon));
      if (import.meta.env.DEV) console.log('OPEN_TIME:', salon?.open_time, 'CLOSE_TIME:', salon?.close_time);
      if (import.meta.env.DEV) console.log('IS_MANUAL_CLOSED:', salon?.is_manual_closed);

      const openTime = salon?.open_time?.trim() || FALLBACK_OPEN_TIME;
      const closeTime = salon?.close_time?.trim() || FALLBACK_CLOSE_TIME;

      if (import.meta.env.DEV) console.log("SLOT_HOURS_USED:", {
        openTime,
        closeTime,
        raw_open: salon?.open_time,
        raw_close: salon?.close_time,
      });

      // Step 3: holiday check first.
      const { data: holiday } = await supabase
        .from("salon_holidays" as any)
        .select("date, name, note, type")
        .eq("salon_id", salonId)
        .eq("date", selectedDate)
        .maybeSingle();

      if (requestId !== requestSequenceRef.current) {
        return;
      }

      const holidayData = holiday as
        | { name: string; note?: string; type: string }
        | null;

      if (holidayData) {
        setHolidayInfo(holidayData);
        setSlots([]);
        setLastUpdated(new Date());
        return;
      }

      setHolidayInfo(null);

      // Step 4: booked slots for the selected day.
      const { data: bookedRecords, error: bookingsError } = await supabase
        .from("queue" as any)
        .select("time_slot, barber_id, status")
        .eq("salon_id", salonId)
        .eq("booking_date", selectedDate)
        .in("status", ["waiting", "confirmed", "in_progress"]);

      if (requestId !== requestSequenceRef.current) {
        return;
      }

      if (import.meta.env.DEV) console.log('SLOT_QUERY:', { 
        date, 
        bookingsFound: bookedRecords?.length || 0,
        error: bookingsError ? { code: bookingsError.code, message: bookingsError.message, details: bookingsError.details } : null
      });

      // Handle query errors gracefully
      if (requestId !== requestSequenceRef.current) {
        return;
      }

      if (bookingsError) {
        if (import.meta.env.DEV) console.error('SLOT_QUERY_ERROR:', bookingsError.code, bookingsError.message, bookingsError.details);
        // Don't crash — just treat as 0 booked slots and show all as available
        setSlots(
          generateTimeSlots(FALLBACK_OPEN_TIME, FALLBACK_CLOSE_TIME).map(
            (timeValue) => ({
              time: formatTimeDisplay(timeValue),
              timeValue,
              available: true,
              bookedCount: 0,
              totalBarbers: 1,
            })
          )
        );
        setLoading(false);
        return;
      }

      // Step 5: fetch barber count.
      let totalBarbers = 1;
      if (!barberId) {
        const { count: barberCount } = await supabase
          .from("barbers" as any)
          .select("*", { count: "exact", head: true })
          .eq("salon_id", salonId);
        totalBarbers = Math.max(barberCount || 1, 1);
      }

      if (requestId !== requestSequenceRef.current) {
        return;
      }

      // Step 6: generate slots for all non-holiday dates.
      const [openH, openM] = parseTimeParts(openTime, FALLBACK_OPEN_TIME);
      const [closeH, closeM] = parseTimeParts(closeTime, FALLBACK_CLOSE_TIME);
      let h = openH;
      let m = openM;

      // Support overnight closing hours by rolling the close boundary to next day.
      let closeBoundary = closeH * 60 + closeM;
      let currentBoundary = h * 60 + m;
      if (closeBoundary <= currentBoundary) {
        closeBoundary += 24 * 60;
      }

      const todayIST = new Date(new Date().toLocaleString('en-US', { timeZone:'Asia/Kolkata' }));
      const todayStr = `${todayIST.getFullYear()}-${String(todayIST.getMonth()+1).padStart(2,'0')}-${String(todayIST.getDate()).padStart(2,'0')}`;
      const isToday = selectedDate === todayStr;

      // Generate 30-min slots between open and close
      const updatedSlots: TimeSlot[] = [];
      while (currentBoundary < closeBoundary) {
        const dayMinutes = currentBoundary % (24 * 60);
        const slotHour = Math.floor(dayMinutes / 60);
        const slotMin = dayMinutes % 60;
        const timeValue = `${String(slotHour).padStart(2,'0')}:${String(slotMin).padStart(2,'0')}:00`;

        const isPast = isToday && (slotHour < todayIST.getHours() || (slotHour === todayIST.getHours() && slotMin <= todayIST.getMinutes()));
        const bookingsAtTime = bookedRecords?.filter((record: any) => record.time_slot === timeValue) || [];
        const bookedCount = barberId
          ? (bookingsAtTime.some((record: any) => record.barber_id === barberId) ? 1 : 0)
          : bookingsAtTime.length;
        const slotBarbers = barberId ? 1 : totalBarbers;

        updatedSlots.push({
          timeValue,
          time: formatTime(slotHour, slotMin),
          available: !isPast && (bookedCount < slotBarbers),
          bookedCount,
          totalBarbers: slotBarbers,
        });

        currentBoundary += SLOT_DURATION_MINUTES;
      }

      if (import.meta.env.DEV) console.log('SLOT_DEBUG:', {
        salonId,
        date: selectedDate,
        openTime,
        closeTime,
        is_manual_closed: salon?.is_manual_closed,
        slotsGenerated: updatedSlots.length,
      });

      if (import.meta.env.DEV) console.log('FINAL_SLOTS:', { 
        totalSlots: updatedSlots.length, 
        availableCount: updatedSlots.filter(s => s.available).length,
        firstSlot: updatedSlots[0],
        lastSlot: updatedSlots[updatedSlots.length - 1],
        barberId,
        date: selectedDate
      });

      setSlots(updatedSlots);
      setLastUpdated(new Date());
    } catch (error) {
      if (requestId !== requestSequenceRef.current) {
        return;
      }
      if (import.meta.env.DEV) console.error("Error fetching slots:", error);
      setSlots([]);
    } finally {
      if (requestId !== requestSequenceRef.current) {
        return;
      }
      setLoading(false);
    }
  }, [salonId, date, barberId]);

  // Initial fetch
  useEffect(() => {
    if (salonId && date) {
      fetchSlots(date);
    }
  }, [fetchSlots, salonId, date]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => fetchSlots(date), 30000);
    return () => clearInterval(interval);
  }, [fetchSlots, date]);

  // Real-time subscription to queue changes
  useEffect(() => {
    if (!salonId) return;

    const subscription = supabase
      .channel(`slots-${salonId}-${date}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "queue",
          filter: `salon_id=eq.${salonId}&booking_date=eq.${date}`,
        },
        () => {
          if (import.meta.env.DEV) console.log("🔄 Slot availability changed - refreshing...");
          fetchSlots(date);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [salonId, date, fetchSlots]);

  const availableCount = slots.filter((s) => s.available).length;
  const totalCount = slots.length;

  return {
    slots,
    loading,
    availableCount,
    totalCount,
    holidayInfo,
    lastUpdated,
    refresh: () => fetchSlots(date),
  };
}

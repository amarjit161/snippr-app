import { useState, useEffect, useCallback } from "react";
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
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
}

const FALLBACK_OPEN_TIME = "09:00";
const FALLBACK_CLOSE_TIME = "20:00";
const SLOT_DURATION_MINUTES = 30;

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
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Fetch available slots
  const fetchSlots = useCallback(async () => {
    if (!salonId || !date) {
      setSlots([]);
      return;
    }

    setLoading(true);
    try {
      // Fetch salon open/close times
      const { data: salon, error: salonError } = await supabase
        .from("salons" as any)
        .select("open_time, close_time")
        .eq("id", salonId)
        .maybeSingle();

      console.log('SALON_FETCH:', { salonId, salon, error: salonError });

      const openTime = salon?.open_time || FALLBACK_OPEN_TIME;
      const closeTime = salon?.close_time || FALLBACK_CLOSE_TIME;

      console.log('SALON_HOURS:', { openTime, closeTime, hasSalonData: !!salon });

      // Generate all time slots for this date
      const allTimeValues = generateTimeSlots(openTime, closeTime);
      console.log('GENERATED_SLOTS:', { total: allTimeValues.length, firstSlot: allTimeValues[0], lastSlot: allTimeValues[allTimeValues.length - 1] });

      // Fetch booked slots from queue
      let query = supabase
        .from("queue" as any)
        .select("time_slot, barber_id, status")
        .eq("salon_id", salonId)
        .eq("booking_date", date)
        .in("status", ["waiting", "confirmed", "in_progress"]);

      const { data: bookedRecords, error: bookingsError } = await query;

      console.log('SLOT_QUERY:', { 
        date, 
        bookingsFound: bookedRecords?.length || 0,
        error: bookingsError ? { code: bookingsError.code, message: bookingsError.message, details: bookingsError.details } : null
      });

      // Handle query errors gracefully
      if (bookingsError) {
        console.error('SLOT_QUERY_ERROR:', bookingsError.code, bookingsError.message, bookingsError.details);
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

      // Fetch barber count if barberId not specified
      let totalBarbers = 1;
      if (!barberId) {
        const { data: barberData } = await supabase
          .from("barbers" as any)
          .select("id")
          .eq("salon_id", salonId);
        totalBarbers = barberData?.length || 1;
      }

      // Check if date is today and mark past times as unavailable
      const today = new Date().toISOString().split("T")[0];
      const isToday = date === today;
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      // Build slots array with availability
      const updatedSlots: TimeSlot[] = allTimeValues.map((timeValue) => {
        // Check if time has passed (if today)
        if (isToday) {
          const [hours, minutes] = timeValue.split(":").map(Number);
          const slotMinutes = hours * 60 + minutes;
          if (slotMinutes <= currentMinutes) {
            return {
              time: formatTimeDisplay(timeValue),
              timeValue,
              available: false,
              bookedCount: 0,
              totalBarbers,
            };
          }
        }

        // Count bookings at this time
        const bookingsAtTime = bookedRecords?.filter(
          (record: any) => record.time_slot === timeValue
        ) || [];

        if (barberId) {
          // If specific barber: check if this barber has a booking
          const isBarberBooked = bookingsAtTime.some(
            (record: any) => record.barber_id === barberId
          );
          return {
            time: formatTimeDisplay(timeValue),
            timeValue,
            available: !isBarberBooked,
            bookedCount: isBarberBooked ? 1 : 0,
            totalBarbers: 1,
          };
        } else {
          // If no specific barber: slot is available if ANY barber is free
          return {
            time: formatTimeDisplay(timeValue),
            timeValue,
            available: bookingsAtTime.length < totalBarbers,
            bookedCount: bookingsAtTime.length,
            totalBarbers,
          };
        }
      });

      console.log('FINAL_SLOTS:', { 
        totalSlots: updatedSlots.length, 
        availableCount: updatedSlots.filter(s => s.available).length,
        firstSlot: updatedSlots[0],
        lastSlot: updatedSlots[updatedSlots.length - 1],
        barberId,
        date
      });

      setSlots(updatedSlots);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error fetching slots:", error);
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, [salonId, date, barberId]);

  // Initial fetch
  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchSlots, 30000);
    return () => clearInterval(interval);
  }, [fetchSlots]);

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
          console.log("🔄 Slot availability changed - refreshing...");
          fetchSlots();
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
    lastUpdated,
    refresh: fetchSlots,
  };
}

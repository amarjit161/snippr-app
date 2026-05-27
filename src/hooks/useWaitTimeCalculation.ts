import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

interface WaitTimeData {
  estimatedWaitMinutes: number;
  currentQueueCount: number;
  totalActiveMinutes: number;
  barbersAvailable: number;
  lastUpdated: Date | null;
}

/**
 * Hook to calculate dynamic wait times for a booking
 * Automatically updates as queue changes
 */
export function useWaitTimeCalculation(
  salonId: string | null,
  barberId: string | null,
  bookingDate: string | null,
  selectedDuration: number = 30
): WaitTimeData {
  const [data, setData] = useState<WaitTimeData>({
    estimatedWaitMinutes: 0,
    currentQueueCount: 0,
    totalActiveMinutes: 0,
    barbersAvailable: 0,
    lastUpdated: null,
  });
  const [loading, setLoading] = useState(false);

  const calculateWaitTime = useCallback(async () => {
    if (!salonId || !bookingDate) {
      setData({
        estimatedWaitMinutes: 0,
        currentQueueCount: 0,
        totalActiveMinutes: 0,
        barbersAvailable: 0,
        lastUpdated: null,
      });
      return;
    }

    setLoading(true);

    try {
      let query = supabase
        .from("queue")
        .select("id, barber_id, total_duration, status")
        .eq("salon_id", salonId)
        .eq("booking_date", bookingDate)
        .in("status", ["waiting", "confirmed", "in_progress"]);

      // If specific barber selected, filter by that barber
      if (barberId) {
        query = query.eq("barber_id", barberId);
      }

      const { data: queueData, error } = await query;

      if (error) {
        console.error("Error fetching queue data:", error);
        setLoading(false);
        return;
      }

      const queue = queueData || [];
      const totalActiveMinutes = queue.reduce(
        (sum: number, item: any) => sum + (item.total_duration || 30),
        0
      );

      // If barberId not specified, get count of available barbers
      let barbersAvailable = 0;
      if (!barberId) {
        const { data: barbers, error: barbersError } = await supabase
          .from("barbers")
          .select("id")
          .eq("salon_id", salonId)
          .eq("is_active", true);

        if (!barbersError) {
          barbersAvailable = barbers?.length || 0;
        }
      } else {
        barbersAvailable = 1;
      }

      // Estimate wait: current queue duration + some buffer
      let estimatedWaitMinutes = totalActiveMinutes;

      // If multiple barbers, divide queue across them
      if (barbersAvailable > 1 && !barberId) {
        estimatedWaitMinutes = Math.ceil(totalActiveMinutes / barbersAvailable);
      }

      // Add a small buffer (2-3 minutes per booking for transitions)
      const bufferMinutes = Math.min(queue.length * 2, 15);
      estimatedWaitMinutes += bufferMinutes;

      setData({
        estimatedWaitMinutes,
        currentQueueCount: queue.length,
        totalActiveMinutes,
        barbersAvailable,
        lastUpdated: new Date(),
      });
    } catch (error) {
      console.error("Error calculating wait time:", error);
    } finally {
      setLoading(false);
    }
  }, [salonId, barberId, bookingDate]);

  // Initial calculation
  useEffect(() => {
    calculateWaitTime();
  }, [calculateWaitTime]);

  // Set up real-time subscription to queue changes
  useEffect(() => {
    if (!salonId) return;

    // Subscribe to queue changes
    const subscription = supabase
      .channel(`queue-${salonId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "queue",
          filter: `salon_id=eq.${salonId}`,
        },
        (payload) => {
          console.log("Queue change detected:", payload);
          // Recalculate on any queue change
          calculateWaitTime();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [salonId, calculateWaitTime]);

  return data;
}

/**
 * Hook to get queue position for a specific booking
 */
export function useQueuePosition(
  salonId: string | null,
  barberId: string | null,
  bookingDate: string | null,
  statusFilter: string[] = ["waiting", "confirmed"]
): number {
  const [position, setPosition] = useState(0);

  useEffect(() => {
    if (!salonId || !barberId || !bookingDate) {
      setPosition(0);
      return;
    }

    const fetchPosition = async () => {
      try {
        const { data, error } = await supabase
          .from("queue")
          .select("id")
          .eq("salon_id", salonId)
          .eq("barber_id", barberId)
          .eq("booking_date", bookingDate)
          .in("status", statusFilter)
          .order("created_at", { ascending: true });

        if (error) throw error;

        setPosition((data?.length || 0) + 1);
      } catch (error) {
        console.error("Error fetching queue position:", error);
        setPosition(0);
      }
    };

    fetchPosition();

    // Subscribe to changes
    const subscription = supabase
      .channel(`queue-position-${salonId}-${barberId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "queue",
          filter: `salon_id=eq.${salonId}`,
        },
        () => {
          fetchPosition();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [salonId, barberId, bookingDate, statusFilter]);

  return position;
}

/**
 * Hook to get estimated completion time
 */
export function useEstimatedCompletion(
  salonId: string | null,
  barberId: string | null,
  bookingDate: string | null,
  serviceDuration: number = 30
): { completionTime: string; completionMinutes: number } {
  const waitData = useWaitTimeCalculation(
    salonId,
    barberId,
    bookingDate,
    serviceDuration
  );

  const completionMinutes = waitData.estimatedWaitMinutes + serviceDuration;

  // Convert minutes to time of day (assuming bookings start at 10 AM)
  const startHour = 10;
  const startMinutes = 0;
  const totalMinutes = startMinutes + completionMinutes;
  const completionHour = startHour + Math.floor(totalMinutes / 60);
  const completionMins = totalMinutes % 60;

  const period = completionHour >= 12 ? "PM" : "AM";
  const displayHour = completionHour > 12 ? completionHour - 12 : completionHour === 0 ? 12 : completionHour;

  const completionTime = `${String(displayHour).padStart(2, " ")}:${String(completionMins).padStart(2, "0")} ${period}`;

  return {
    completionTime,
    completionMinutes,
  };
}

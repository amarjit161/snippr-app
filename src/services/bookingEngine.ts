import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export interface ServiceSelection {
  id: string;
  name: string;
  duration: number;
  price: number;
}

export interface BarberAssignmentResult {
  barberId: string;
  barberName: string;
  supportedServices: number;
  totalServiceCount: number;
  canServiceAll: boolean;
  activeQueueCount: number;
  workloadScore: number;
  estimatedWaitMinutes: number;
  estimatedCompletionTime: string;
  assignmentReason: string;
}

export interface BarberSuggestion {
  barberId: string;
  barberName: string;
  canServiceAll: boolean;
  workloadScore: number;
  matchedServices: number;
  unmatchedServices: string[];
  isReccommended: boolean;
}

/**
 * Calculate workload score for a barber
 * Lower score = better capacity
 * 
 * Score components:
 * - Active queue count: 0.5 weight
 * - Total booking duration: 0.3 weight
 * - Online status: 0.2 weight
 */
function calculateWorkloadScore(
  activeQueueCount: number,
  totalDuration: number,
  isOnline: boolean
): number {
  const queueScore = activeQueueCount * 0.5; // Each booking adds 0.5
  const durationScore = Math.ceil(totalDuration / 30) * 0.3; // Each 30min adds 0.3
  const onlineScore = isOnline ? 0 : 1000; // Heavily penalize offline barbers
  
  return queueScore + durationScore + onlineScore;
}

/**
 * Get the next available time slot for a barber
 */
async function getNextAvailableSlot(
  barberId: string,
  salonId: string,
  bookingDate: string,
  totalDuration: number
): Promise<{ slot: string; completionTime: string } | null> {
  try {
    // Get all bookings for this barber on this date
    const { data: bookings, error } = await supabase
      .from("queue")
      .select("time_slot, total_duration")
      .eq("barber_id", barberId)
      .eq("salon_id", salonId)
      .eq("booking_date", bookingDate)
      .in("status", ["waiting", "confirmed", "in_progress"]);

    if (error) {
      console.error("Error fetching barber bookings:", error);
      return null;
    }

    // Calculate total occupied time
    const totalOccupiedMinutes = (bookings || []).reduce(
      (sum: number, b: any) => sum + (b.total_duration || 30),
      0
    );

    // Estimate next available time (assume 30-min slots)
    const slotsOccupied = Math.ceil(totalOccupiedMinutes / 30);
    const estimatedSlotMinutes = slotsOccupied * 30;

    // Format as HH:MM AM/PM
    const hours = 10 + Math.floor(estimatedSlotMinutes / 60);
    const minutes = estimatedSlotMinutes % 60;
    
    if (hours >= 21) {
      return null; // Salon closes at 9 PM
    }

    const period = hours >= 12 ? "PM" : "AM";
    const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    const slot = `${String(displayHours).padStart(2, " ")}:${String(minutes).padStart(2, "0")} ${period}`;

    // Calculate completion time
    const completionMinutes = estimatedSlotMinutes + totalDuration;
    const completionHours = 10 + Math.floor(completionMinutes / 60);
    const completionMins = completionMinutes % 60;
    
    const completionPeriod = completionHours >= 12 ? "PM" : "AM";
    const completionDisplayHours = completionHours > 12 ? completionHours - 12 : completionHours;
    const completionTime = `${String(completionDisplayHours).padStart(2, " ")}:${String(completionMins).padStart(2, "0")} ${completionPeriod}`;

    return { slot, completionTime };
  } catch (error) {
    console.error("Error calculating next available slot:", error);
    return null;
  }
}

/**
 * Check if a barber can perform all selected services
 */
async function canBarberServiceAll(
  barberId: string,
  serviceIds: string[]
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("barber_services")
      .select("service_id")
      .eq("barber_id", barberId)
      .in("service_id", serviceIds);

    if (error) {
      console.error("Error checking barber services:", error);
      return false;
    }

    const supportedServices = new Set((data || []).map(s => s.service_id));
    return serviceIds.every(id => supportedServices.has(id));
  } catch (error) {
    console.error("Error in canBarberServiceAll:", error);
    return false;
  }
}

/**
 * Get services a barber can perform
 */
async function getBarberSupportedServices(
  barberId: string
): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from("barber_services")
      .select("service_id")
      .eq("barber_id", barberId);

    if (error) return [];
    return (data || []).map(s => s.service_id);
  } catch (error) {
    console.error("Error fetching barber services:", error);
    return [];
  }
}

/**
 * Assign the best barber for multi-service booking
 * 
 * Priority logic:
 * 1. Can perform ALL selected services
 * 2. Lowest active queue count
 * 3. Earliest available slot
 * 4. Online status (prefer online barbers)
 */
export async function assignBestBarber(
  salonId: string,
  selectedServices: ServiceSelection[],
  bookingDate: string
): Promise<BarberAssignmentResult | null> {
  try {
    const serviceIds = selectedServices.map(s => s.id);
    const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0);
    const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);

    console.log("🎯 SMART_ASSIGNMENT_START", {
      salonId,
      serviceIds,
      totalDuration,
      bookingDate,
    });

    // Fetch all active barbers for the salon
    const { data: barbers, error: barbersError } = await supabase
      .from("barbers")
      .select("id, name, is_online, is_active")
      .eq("salon_id", salonId)
      .eq("is_active", true)
      .order("name");

    if (barbersError || !barbers || barbers.length === 0) {
      console.error("❌ No active barbers found for salon:", salonId);
      return null;
    }

    // Fetch workload data for all barbers
    const { data: workloadData, error: workloadError } = await supabase
      .from("queue")
      .select("barber_id, status, total_duration")
      .eq("salon_id", salonId)
      .eq("booking_date", bookingDate)
      .in("status", ["waiting", "confirmed", "in_progress"]);

    if (workloadError) {
      console.error("❌ Error fetching workload data:", workloadError);
      return null;
    }

    // Calculate workload per barber
    const workloadMap = new Map<string, { count: number; duration: number }>();
    (workloadData || []).forEach((q: any) => {
      if (!workloadMap.has(q.barber_id)) {
        workloadMap.set(q.barber_id, { count: 0, duration: 0 });
      }
      const current = workloadMap.get(q.barber_id)!;
      current.count++;
      current.duration += q.total_duration || 30;
    });

    // Score each barber
    const barberScores: Array<{
      barber: any;
      canServiceAll: boolean;
      workloadScore: number;
      queueCount: number;
      duration: number;
    }> = [];

    for (const barber of barbers) {
      const canServiceAll = await canBarberServiceAll(barber.id, serviceIds);
      const workload = workloadMap.get(barber.id) || { count: 0, duration: 0 };
      const workloadScore = calculateWorkloadScore(
        workload.count,
        workload.duration,
        barber.is_online
      );

      barberScores.push({
        barber,
        canServiceAll,
        workloadScore,
        queueCount: workload.count,
        duration: workload.duration,
      });

      console.log("📊 BARBER_SCORE", {
        barberId: barber.id,
        barberName: barber.name,
        canServiceAll,
        workloadScore,
        queueCount: workload.count,
        isOnline: barber.is_online,
      });
    }

    // Sort by priority
    barberScores.sort((a, b) => {
      // Priority 1: Can service all
      if (a.canServiceAll !== b.canServiceAll) {
        return a.canServiceAll ? -1 : 1;
      }
      // Priority 2: Lowest workload score
      if (a.workloadScore !== b.workloadScore) {
        return a.workloadScore - b.workloadScore;
      }
      // Priority 3: Earliest
      return a.barber.created_at < b.barber.created_at ? -1 : 1;
    });

    const bestBarber = barberScores[0];

    if (!bestBarber) {
      console.error("❌ No suitable barber found");
      return null;
    }

    // Get next available slot
    const slotInfo = await getNextAvailableSlot(
      bestBarber.barber.id,
      salonId,
      bookingDate,
      totalDuration
    );

    if (!slotInfo) {
      console.warn("⚠️ Could not calculate next available slot");
    }

    const estimatedWaitMinutes = bestBarber.duration + (bestBarber.queueCount > 0 ? 5 : 0);
    
    const result: BarberAssignmentResult = {
      barberId: bestBarber.barber.id,
      barberName: bestBarber.barber.name,
      supportedServices: (await getBarberSupportedServices(bestBarber.barber.id)).length,
      totalServiceCount: serviceIds.length,
      canServiceAll: bestBarber.canServiceAll,
      activeQueueCount: bestBarber.queueCount,
      workloadScore: bestBarber.workloadScore,
      estimatedWaitMinutes,
      estimatedCompletionTime: slotInfo?.completionTime || "Unknown",
      assignmentReason: bestBarber.canServiceAll
        ? `${bestBarber.barber.name} can handle all services (Queue: ${bestBarber.queueCount} bookings)`
        : `${bestBarber.barber.name} best match (${bestBarber.queueCount} active bookings)`,
    };

    console.log("✅ BEST_BARBER_ASSIGNED", result);
    return result;
  } catch (error) {
    console.error("❌ ERROR in assignBestBarber:", error);
    return null;
  }
}

/**
 * Get alternative barber suggestions if all services can't be matched
 */
export async function getBarberSuggestions(
  salonId: string,
  selectedServices: ServiceSelection[],
  bookingDate: string
): Promise<BarberSuggestion[]> {
  try {
    const serviceIds = selectedServices.map(s => s.id);

    // Fetch all barbers
    const { data: barbers, error } = await supabase
      .from("barbers")
      .select("id, name, is_online")
      .eq("salon_id", salonId)
      .eq("is_active", true);

    if (error || !barbers) return [];

    const suggestions: BarberSuggestion[] = [];

    for (const barber of barbers) {
      const supportedServices = await getBarberSupportedServices(barber.id);
      const supportedSet = new Set(supportedServices);
      
      const matched = serviceIds.filter(id => supportedSet.has(id));
      const unmatched = selectedServices
        .filter(s => !supportedSet.has(s.id))
        .map(s => s.name);

      // Get workload
      const { data: workload } = await supabase
        .from("queue")
        .select("id")
        .eq("barber_id", barber.id)
        .eq("salon_id", salonId)
        .eq("booking_date", bookingDate)
        .in("status", ["waiting", "confirmed", "in_progress"]);

      const score = calculateWorkloadScore(
        (workload || []).length,
        0,
        barber.is_online
      );

      suggestions.push({
        barberId: barber.id,
        barberName: barber.name,
        canServiceAll: matched.length === serviceIds.length,
        workloadScore: score,
        matchedServices: matched.length,
        unmatchedServices: unmatched,
        isReccommended: barber.is_online && matched.length > 0,
      });
    }

    return suggestions.sort((a, b) => {
      if (a.canServiceAll !== b.canServiceAll) {
        return a.canServiceAll ? -1 : 1;
      }
      return a.workloadScore - b.workloadScore;
    });
  } catch (error) {
    console.error("❌ Error getting barber suggestions:", error);
    return [];
  }
}

/**
 * Validate barber can be assigned to a booking
 */
export async function validateBarberAssignment(
  barberId: string,
  selectedServices: ServiceSelection[],
  bookingDate: string
): Promise<{ valid: boolean; reason: string }> {
  try {
    // Check if barber exists and is active
    const { data: barber, error: barberError } = await supabase
      .from("barbers")
      .select("id, is_active, is_online")
      .eq("id", barberId)
      .single();

    if (barberError || !barber || !barber.is_active) {
      return { valid: false, reason: "Barber is not available" };
    }

    // Check if barber can service all selected services
    const canServiceAll = await canBarberServiceAll(
      barberId,
      selectedServices.map(s => s.id)
    );

    if (!canServiceAll) {
      const supported = await getBarberSupportedServices(barberId);
      const supportedSet = new Set(supported);
      const unsupported = selectedServices
        .filter(s => !supportedSet.has(s.id))
        .map(s => s.name);
      
      return {
        valid: false,
        reason: `Barber cannot perform: ${unsupported.join(", ")}`,
      };
    }

    return { valid: true, reason: "Barber can be assigned" };
  } catch (error) {
    console.error("❌ Error validating barber assignment:", error);
    return { valid: false, reason: "Validation error" };
  }
}

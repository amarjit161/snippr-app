import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export interface ValidationError {
  field: string;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validate multi-service booking
 */
export async function validateMultiServiceBooking(
  salonId: string,
  serviceIds: string[],
  barberId: string,
  bookingDate: string,
  timeSlot: string
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];

  // Check 1: At least one service selected
  if (!serviceIds || serviceIds.length === 0) {
    errors.push({
      field: "services",
      message: "At least one service must be selected",
      severity: "error",
    });
    return { valid: false, errors };
  }

  // Check 2: No duplicate services
  const uniqueServices = new Set(serviceIds);
  if (uniqueServices.size !== serviceIds.length) {
    errors.push({
      field: "services",
      message: "Duplicate services are not allowed",
      severity: "error",
    });
  }

  // Check 3: Validate barber exists and is active
  const { data: barber, error: barberError } = await supabase
    .from("barbers")
    .select("id, is_active, is_online")
    .eq("id", barberId)
    .single();

  if (barberError || !barber || !barber.is_active) {
    errors.push({
      field: "barber",
      message: "Selected barber is not available",
      severity: "error",
    });
  }

  // Check 4: Validate barber can perform all services
  if (barber) {
    const { data: barberServices, error: servicesError } = await supabase
      .from("barber_services")
      .select("service_id")
      .eq("barber_id", barberId)
      .in("service_id", serviceIds);

    if (servicesError || !barberServices) {
      errors.push({
        field: "services",
        message: "Error validating barber services",
        severity: "error",
      });
    } else {
      const supportedIds = new Set(barberServices.map(s => s.service_id));
      const unsupported = serviceIds.filter(id => !supportedIds.has(id));

      if (unsupported.length > 0) {
        errors.push({
          field: "barber",
          message: `Barber cannot perform selected services`,
          severity: "error",
        });
      }
    }
  }

  // Check 5: Validate services exist
  const { data: services, error: fetchServicesError } = await supabase
    .from("services")
    .select("id, salon_id")
    .in("id", serviceIds);

  if (fetchServicesError || !services) {
    errors.push({
      field: "services",
      message: "Error validating services",
      severity: "error",
    });
  } else {
    // Ensure all services belong to the same salon
    const servicesInWrongSalon = services.filter(s => s.salon_id !== salonId);
    if (servicesInWrongSalon.length > 0) {
      errors.push({
        field: "services",
        message: "All services must belong to the selected salon",
        severity: "error",
      });
    }

    // Check if all requested services were found
    if (services.length !== serviceIds.length) {
      errors.push({
        field: "services",
        message: "Some selected services could not be found",
        severity: "error",
      });
    }
  }

  // Check 6: Validate booking date
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const bookingDateObj = new Date(bookingDate);
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + 30);

  if (bookingDateObj < today || bookingDateObj > maxDate) {
    errors.push({
      field: "date",
      message: "Booking must be within the next 30 days",
      severity: "error",
    });
  }

  // Check 7: Check time slot availability
  const { data: conflict, error: conflictError } = await supabase
    .from("queue")
    .select("id")
    .eq("salon_id", salonId)
    .eq("barber_id", barberId)
    .eq("booking_date", bookingDate)
    .eq("time_slot", timeSlot)
    .in("status", ["waiting", "confirmed", "in_progress"])
    .limit(1)
    .maybeSingle();

  if (conflictError) {
    errors.push({
      field: "timeSlot",
      message: "Error checking time slot availability",
      severity: "error",
    });
  } else if (conflict) {
    errors.push({
      field: "timeSlot",
      message: "This time slot is no longer available",
      severity: "error",
    });
  }

  // Check 8: Check queue limits
  const { data: queueCount, error: queueError } = await supabase
    .from("queue")
    .select("id", { count: "exact", head: true })
    .eq("salon_id", salonId)
    .eq("booking_date", bookingDate)
    .in("status", ["waiting", "confirmed"]);

  if (!queueError && queueCount && queueCount > 50) {
    errors.push({
      field: "queue",
      message: "Queue is full. Please try another date or time",
      severity: "warning",
    });
  }

  // Check 9: Check for overbooked barber
  const { data: barberQueue } = await supabase
    .from("queue")
    .select("id")
    .eq("barber_id", barberId)
    .eq("salon_id", salonId)
    .eq("booking_date", bookingDate)
    .in("status", ["waiting", "confirmed", "in_progress"]);

  const totalBarberMinutes = (barberQueue || []).length * 30;

  // Assuming salon operates 11 hours (10 AM - 9 PM)
  const maxDailyMinutes = 11 * 60;
  
  if (totalBarberMinutes > maxDailyMinutes * 0.9) {
    errors.push({
      field: "barber",
      message: `${barber?.name} is heavily booked. Consider another barber`,
      severity: "warning",
    });
  }

  // Check 10: Validate user doesn't have duplicate active bookings
  const { user } = await supabase.auth.getUser();
  if (user) {
    const today = new Date().toISOString().split("T")[0];
    const { data: activeBooking } = await supabase
      .from("queue")
      .select("id")
      .eq("user_id", user.user?.id)
      .gte("booking_date", today)
      .in("status", ["waiting", "confirmed", "accepted", "in_progress"])
      .limit(1)
      .maybeSingle();

    if (activeBooking) {
      errors.push({
        field: "user",
        message: "You already have an active booking. Cancel it before booking again",
        severity: "error",
      });
    }
  }

  return {
    valid: errors.filter(e => e.severity === "error").length === 0,
    errors,
  };
}

/**
 * Validate individual service selection
 */
export async function validateService(
  serviceId: string,
  salonId: string
): Promise<{ valid: boolean; service?: Tables<"services">; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("services")
      .select("*")
      .eq("id", serviceId)
      .eq("salon_id", salonId)
      .single();

    if (error || !data) {
      return { valid: false, error: "Service not found or unavailable" };
    }

    // Validate service has required fields
    if (!data.name || typeof data.price !== "number" || typeof data.duration !== "number") {
      return {
        valid: false,
        error: "Service data is incomplete",
      };
    }

    return { valid: true, service: data };
  } catch (error) {
    console.error("Error validating service:", error);
    return { valid: false, error: "Validation error" };
  }
}

/**
 * Validate barber service assignment
 */
export async function validateBarberServiceAssignment(
  barberId: string,
  serviceIds: string[]
): Promise<{
  valid: boolean;
  canServiceAll: boolean;
  supportedServices: string[];
  unsupportedServices: string[];
}> {
  try {
    const { data: barberServices, error } = await supabase
      .from("barber_services")
      .select("service_id")
      .eq("barber_id", barberId)
      .in("service_id", serviceIds);

    if (error) {
      return {
        valid: false,
        canServiceAll: false,
        supportedServices: [],
        unsupportedServices: serviceIds,
      };
    }

    const supported = barberServices.map(s => s.service_id);
    const supportedSet = new Set(supported);
    const unsupported = serviceIds.filter(id => !supportedSet.has(id));

    return {
      valid: unsupported.length === 0,
      canServiceAll: unsupported.length === 0,
      supportedServices: supported,
      unsupportedServices: unsupported,
    };
  } catch (error) {
    console.error("Error validating barber service assignment:", error);
    return {
      valid: false,
      canServiceAll: false,
      supportedServices: [],
      unsupportedServices: serviceIds,
    };
  }
}

/**
 * Check if a time slot is actually available
 */
export async function validateTimeSlotAvailability(
  salonId: string,
  barberId: string,
  bookingDate: string,
  timeSlot: string
): Promise<{ available: boolean; reason?: string }> {
  try {
    const { data, error } = await supabase
      .from("queue")
      .select("id")
      .eq("salon_id", salonId)
      .eq("barber_id", barberId)
      .eq("booking_date", bookingDate)
      .eq("time_slot", timeSlot)
      .in("status", ["waiting", "confirmed", "in_progress"])
      .limit(1)
      .maybeSingle();

    if (error) {
      return { available: false, reason: "Error checking availability" };
    }

    if (data) {
      return { available: false, reason: "Time slot already booked" };
    }

    return { available: true };
  } catch (error) {
    console.error("Error validating time slot:", error);
    return { available: false, reason: "Validation error" };
  }
}

/**
 * Validate all booking details comprehensively
 */
export async function validateCompleteBooking(
  salonId: string,
  serviceIds: string[],
  barberId: string,
  bookingDate: string,
  timeSlot: string,
  customerName: string,
  customerPhone: string
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];

  // Validate customer info
  if (!customerName || customerName.trim().length < 2) {
    errors.push({
      field: "customerName",
      message: "Customer name must be at least 2 characters",
      severity: "error",
    });
  }

  if (!customerPhone || customerPhone.trim().length < 10) {
    errors.push({
      field: "customerPhone",
      message: "Valid phone number required",
      severity: "error",
    });
  }

  // Validate booking details
  const bookingValidation = await validateMultiServiceBooking(
    salonId,
    serviceIds,
    barberId,
    bookingDate,
    timeSlot
  );

  errors.push(...bookingValidation.errors);

  return {
    valid: errors.filter(e => e.severity === "error").length === 0,
    errors,
  };
}

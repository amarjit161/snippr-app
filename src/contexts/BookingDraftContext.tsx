import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate, Outlet } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { publicSupabase } from "@/integrations/supabase/publicClient";
import { useAuth } from "@/contexts/AuthContext";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { parseBookingError } from "@/lib/rlsErrorHandler";
import { verifySession } from "@/lib/sessionValidator";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { generateOTP } from "@/lib/otpUtils";
import { sendBookingEmail } from "@/services/emailService";
import { useSmartBarberAssignment, type BarberAssignmentResult } from "@/hooks/useSmartBarberAssignment";
import type { Tables } from "@/integrations/supabase/types";
import type { TurnstileCaptchaHandle } from "@/components/TurnstileCaptcha";

const CUSTOMER_PROFILE_STORAGE_KEY = "snippr_customer_profile";
const BOOKING_SALON_ID_KEY = "snippr_booking_salon_id";
const BOOKING_DRAFT_KEY = "snippr_booking_draft";
const BOOKING_DRAFT_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours — short-lived, matches the checkout-flow lifespan

interface PersistedBookingDraft {
  salonId: string;
  savedAt: number;
  selectedServices: Tables<"services">[];
  date: string;
  time: string;
  timeLabel: string;
  customer: CustomerInfo;
  bookingForSomeoneElse: boolean;
}

export type BarberRow = {
  id: string;
  name: string;
  chair_number: number | null;
  specialization: string | null;
};

export type CustomerInfo = {
  firstName: string;
  lastName: string;
  phone: string;
  altPhone: string;
  notes: string;
};

export type ConfirmedBookingState = {
  salonName: string;
  serviceName: string;
  address: string;
  image: string;
  estimatedWait: string;
  queuePosition: number | string;
  bookingId: string;
  arrivalOTP: string;
};

export const BOOKING_STEPS = [
  { key: "service", label: "Service", path: "/booking/service" },
  { key: "stylist", label: "Stylist", path: "/booking/stylist" },
  { key: "date", label: "Date", path: "/booking/date" },
  { key: "time", label: "Time", path: "/booking/time" },
  { key: "confirm", label: "Confirm", path: "/booking/confirm" },
] as const;

export const getMinDate = (): string => new Date().toISOString().split("T")[0];
export const getMaxDate = (): string => {
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 30);
  return maxDate.toISOString().split("T")[0];
};

interface BookingDraftContextValue {
  loadingSalon: boolean;
  salon: Tables<"salons"> | null;
  services: Tables<"services">[];
  barbers: BarberRow[];
  selectedServices: Tables<"services">[];
  setSelectedServices: (services: Tables<"services">[]) => void;
  assignmentResult: BarberAssignmentResult | null;
  isAssigning: boolean;
  assignmentError: string | null;
  allBarbers: ReturnType<typeof useSmartBarberAssignment>["allBarbers"];
  triggerAssignment: () => void;
  handleBarberChange: (barber: ReturnType<typeof useSmartBarberAssignment>["allBarbers"][number]) => void;
  date: string;
  setDate: (date: string) => void;
  time: string;
  setTime: (time: string) => void;
  timeLabel: string;
  setTimeLabel: (label: string) => void;
  nextQueuePosition: number | null;
  customer: CustomerInfo;
  setCustomer: React.Dispatch<React.SetStateAction<CustomerInfo>>;
  hasSavedProfile: boolean;
  savedProfile: CustomerInfo;
  bookingForSomeoneElse: boolean;
  setBookingForSomeoneElse: (value: boolean) => void;
  saveProfile: (draft: { firstName: string; lastName: string; phone: string }) => void;
  activeCustomer: CustomerInfo;
  bookedSlots: Set<string>;
  turnstileRef: React.MutableRefObject<TurnstileCaptchaHandle | null>;
  captchaToken: string | null;
  setCaptchaToken: (token: string | null) => void;
  booking: boolean;
  verifyingCaptcha: boolean;
  confirmedBookingState: ConfirmedBookingState | null;
  submitBooking: () => Promise<void>;
  goToStep: (stepKey: (typeof BOOKING_STEPS)[number]["key"]) => void;
  exitFlow: () => void;
}

const BookingDraftContext = createContext<BookingDraftContextValue | null>(null);

export const useBookingDraft = () => {
  const ctx = useContext(BookingDraftContext);
  if (!ctx) throw new Error("useBookingDraft must be used within BookingFlowProvider");
  return ctx;
};

export function startBookingFlow(salonId: string, navigate: (path: string) => void) {
  sessionStorage.setItem(BOOKING_SALON_ID_KEY, salonId);
  navigate("/booking/service");
}

export function BookingFlowProvider() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { handleBookingError } = useErrorHandler();
  const { assignBestBarber, isAssigning, error: assignmentError, result: assignmentResult, allBarbers } = useSmartBarberAssignment();

  const [salon, setSalon] = useState<Tables<"salons"> | null>(null);
  const [loadingSalon, setLoadingSalon] = useState(true);
  const [services, setServices] = useState<Tables<"services">[]>([]);
  const [barbers, setBarbers] = useState<BarberRow[]>([]);
  const [selectedServices, setSelectedServices] = useState<Tables<"services">[]>([]);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [timeLabel, setTimeLabel] = useState("");
  const [nextQueuePosition, setNextQueuePosition] = useState<number | null>(null);
  const [customer, setCustomer] = useState<CustomerInfo>({ firstName: "", lastName: "", phone: "", altPhone: "", notes: "" });
  const [savedProfile, setSavedProfile] = useState<CustomerInfo>({ firstName: "", lastName: "", phone: "", altPhone: "", notes: "" });
  const [hasSavedProfile, setHasSavedProfile] = useState(false);
  const [bookingForSomeoneElse, setBookingForSomeoneElse] = useState(false);
  const [bookedSlots, setBookedSlots] = useState<Set<string>>(new Set());
  const [booking, setBooking] = useState(false);
  const [verifyingCaptcha, setVerifyingCaptcha] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [confirmedBookingState, setConfirmedBookingState] = useState<ConfirmedBookingState | null>(null);
  const turnstileRef = useRef<TurnstileCaptchaHandle | null>(null);

  const exitFlow = () => {
    sessionStorage.removeItem(BOOKING_SALON_ID_KEY);
    sessionStorage.removeItem(BOOKING_DRAFT_KEY);
    navigate("/salons");
  };

  // Resolve salon id (from sessionStorage, set when the flow was started) and fetch the salon.
  useEffect(() => {
    const salonId = sessionStorage.getItem(BOOKING_SALON_ID_KEY);
    if (!salonId) {
      toast.error("Start a booking from a salon page first.");
      navigate("/salons");
      return;
    }

    // Best-effort restore of an in-progress draft (e.g. after a refresh). Only ever
    // applied when it belongs to this exact salon/flow and isn't stale — any mismatch
    // or malformed data is discarded rather than risking a crash or cross-salon leak.
    try {
      const rawDraft = sessionStorage.getItem(BOOKING_DRAFT_KEY);
      if (rawDraft) {
        const parsed = JSON.parse(rawDraft) as Partial<PersistedBookingDraft> | null;
        const isFresh = typeof parsed?.savedAt === "number" && Date.now() - parsed.savedAt < BOOKING_DRAFT_TTL_MS;
        if (parsed && parsed.salonId === salonId && isFresh) {
          if (Array.isArray(parsed.selectedServices)) setSelectedServices(parsed.selectedServices);
          if (typeof parsed.date === "string") setDate(parsed.date);
          if (typeof parsed.time === "string") setTime(parsed.time);
          if (typeof parsed.timeLabel === "string") setTimeLabel(parsed.timeLabel);
          if (parsed.customer && typeof parsed.customer === "object") {
            setCustomer((prev) => ({ ...prev, ...parsed.customer }));
          }
          if (typeof parsed.bookingForSomeoneElse === "boolean") setBookingForSomeoneElse(parsed.bookingForSomeoneElse);
        } else {
          sessionStorage.removeItem(BOOKING_DRAFT_KEY);
        }
      }
    } catch {
      sessionStorage.removeItem(BOOKING_DRAFT_KEY);
    }

    const fetchSalon = async () => {
      setLoadingSalon(true);
      const { data, error } = await publicSupabase
        .from("salons")
        .select("*")
        .eq("id", salonId)
        .maybeSingle();

      if (error || !data) {
        toast.error("Could not load salon details.");
        navigate("/salons");
        return;
      }

      setSalon(data as Tables<"salons">);
      setLoadingSalon(false);
    };

    fetchSalon();
  }, [navigate]);

  // Owner self-booking guard (preserved verbatim from SalonDetail.tsx)
  useEffect(() => {
    const checkOwnerBooking = async () => {
      if (!salon?.id || !user) return;
      const { data: ownedSalon } = await supabase
        .from("salons")
        .select("id")
        .eq("owner_id", user.id)
        .eq("id", salon.id)
        .maybeSingle();

      if (ownedSalon) {
        toast.error("You can't book your own salon 😄");
        exitFlow();
      }
    };
    checkOwnerBooking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salon?.id, user]);

  // Services fetch (preserved verbatim)
  useEffect(() => {
    if (!salon?.id) return;
    const fetchServices = async () => {
      const { data, error } = await publicSupabase
        .from("services")
        .select("id, name, price, duration")
        .eq("salon_id", salon.id)
        .order("name");

      if (error) {
        setServices([]);
        return;
      }
      const safeServices = (data || []).map((svc) => ({
        ...svc,
        name: svc.name ?? "Service",
        price: svc.price ?? 0,
        duration: svc.duration ?? 30,
      }));
      setServices(safeServices as Tables<"services">[]);
    };
    fetchServices();
  }, [salon?.id]);

  // Barbers fetch (preserved verbatim)
  useEffect(() => {
    if (!salon?.id) return;
    const loadBarbers = async () => {
      const { data, error } = await publicSupabase
        .from("barbers")
        .select("id, name, chair_number, specialization")
        .eq("salon_id", salon.id)
        .order("name");

      if (error) {
        setBarbers([]);
        return;
      }
      const safeBarbers = (data || []).map((barber) => ({
        ...barber,
        name: barber.name ?? "Barber",
        chair_number: barber.chair_number ?? 0,
        specialization: barber.specialization ?? "",
      })) as BarberRow[];
      setBarbers(safeBarbers);
    };
    loadBarbers();
  }, [salon?.id]);

  // Saved customer profile from localStorage (preserved verbatim)
  useEffect(() => {
    try {
      const rawProfile = window.localStorage.getItem(CUSTOMER_PROFILE_STORAGE_KEY);
      if (!rawProfile) return;
      const parsed = JSON.parse(rawProfile) as { firstName?: string; lastName?: string; phone?: string };
      const profile = {
        firstName: (parsed.firstName || "").trim(),
        lastName: (parsed.lastName || "").trim(),
        phone: (parsed.phone || "").trim(),
        altPhone: "",
        notes: "",
      };
      if (!profile.firstName || !profile.phone) return;
      setSavedProfile(profile);
      setHasSavedProfile(true);
      setCustomer((prev) => ({ ...prev, ...profile }));
    } catch {
      // ignore invalid localStorage values
    }
  }, []);

  // Reset time when date changes (preserved verbatim)
  useEffect(() => {
    setTime("");
    setTimeLabel("");
  }, [date, assignmentResult?.barberId]);

  // Persist the in-progress draft so a refresh doesn't wipe it out. Namespaced to the
  // current salon id so a stale draft from a different salon/flow is never picked up.
  // Stops once a booking has succeeded so post-success state changes (e.g. clearing the
  // "someone else" customer fields) can't resurrect a draft we just cleared.
  useEffect(() => {
    if (confirmedBookingState) return;
    const salonId = sessionStorage.getItem(BOOKING_SALON_ID_KEY);
    if (!salonId) return;
    const draft: PersistedBookingDraft = {
      salonId,
      savedAt: Date.now(),
      selectedServices,
      date,
      time,
      timeLabel,
      customer,
      bookingForSomeoneElse,
    };
    try {
      sessionStorage.setItem(BOOKING_DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // Ignore storage quota/serialization errors — the draft is a convenience, not critical state.
    }
  }, [selectedServices, date, time, timeLabel, customer, bookingForSomeoneElse, confirmedBookingState]);

  const triggerAssignment = () => {
    if (!salon?.id || selectedServices.length === 0 || assignmentResult) return;
    const bookingDate = date || new Date().toISOString().split("T")[0];
    assignBestBarber(salon.id, selectedServices, bookingDate);
  };

  // If a restored draft (e.g. after a refresh) already has services selected but the
  // user isn't currently sitting on /booking/stylist, that page's own auto-trigger never
  // runs. Recompute assignment here too so later steps (time/confirm) aren't left stuck.
  //
  // recoveryAttemptedRef caps this to a single attempt per provider lifetime. Without it,
  // a failed assignment leaves assignmentResult null while isAssigning bounces true->false,
  // which re-satisfies the effect's guard and re-triggers assignment — an unbounded retry
  // loop hammering Supabase. One attempt is enough: on success assignmentResult itself then
  // blocks re-entry; on failure the error stands as a stable, real failure state.
  const recoveryAttemptedRef = useRef(false);
  useEffect(() => {
    if (recoveryAttemptedRef.current) return;
    if (!salon?.id || selectedServices.length === 0 || assignmentResult || isAssigning) return;
    recoveryAttemptedRef.current = true;
    triggerAssignment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salon?.id, selectedServices.length, assignmentResult, isAssigning]);

  // NOTE: in the original SalonDetail.tsx, manual barber selection updated a local
  // `assignedBarber`/`selectedBarberId` pair that was never actually read by the booking
  // submission or by AssignmentLoader's displayed result (both used the hook's own
  // `assignmentResult` exclusively) — manual override was already inert before this
  // restructuring. Preserved as-is rather than silently fixed; flagged separately.
  const [manualBarberPick, setManualBarberPick] = useState<BarberAssignmentResult | null>(null);
  const handleBarberChange = (barber: (typeof allBarbers)[number]) => {
    setManualBarberPick({
      barberId: barber.barber.id,
      barberName: barber.barber.name,
      workloadScore: barber.score,
      estimatedWait: barber.estimatedWait,
      completionTime: barber.completionTime,
      reason: barber.reason,
    });
  };

  // Next queue position + realtime channel (preserved verbatim, runs for the whole flow lifetime)
  useEffect(() => {
    if (!salon?.id) return;

    const fetchNextPosition = async () => {
      const { data } = await (supabase.from("bookings" as any) as any)
        .select("position")
        .eq("salon_id", salon.id)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();
      const latest = Number(data?.position || 0);
      setNextQueuePosition(latest + 1);
    };

    fetchNextPosition();

    const channel = supabase
      .channel(`queue-position-${salon.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `salon_id=eq.${salon.id}` }, () => fetchNextPosition())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [salon?.id]);

  // Availability check + realtime channel (preserved verbatim)
  useEffect(() => {
    if (!salon?.id || !date || !assignmentResult?.barberId) return;

    const checkAvailability = async () => {
      const { data } = await supabase
        .from("bookings" as any)
        .select("booking_time")
        .eq("salon_id", salon.id)
        .eq("stylist_id", assignmentResult.barberId)
        .eq("booking_date", date)
        .in("status", ["pending", "waiting", "in_progress"]);
      const booked = new Set((data || []).map((b: any) => b.booking_time).filter(Boolean));
      setBookedSlots(booked);
    };

    checkAvailability();

    let subscription: any = null;
    try {
      subscription = supabase
        .channel(`bookings-${salon.id}-${date}`)
        .on(
          "postgres_changes",
          { event: "INSERT,UPDATE", schema: "public", table: "bookings", filter: `salon_id=eq.${salon.id}` },
          (payload) => {
            const payloadDate = payload?.new?.booking_date || payload?.old?.booking_date;
            if (payloadDate === date && assignmentResult?.barberId) checkAvailability();
          }
        )
        .subscribe();
    } catch {
      // ignore realtime subscription errors
    }

    return () => {
      if (subscription) supabase.removeChannel(subscription);
    };
  }, [salon?.id, date, assignmentResult?.barberId]);

  // Periodic 3s poll fallback — originally gated on currentStep===4 (the time-selection step);
  // now gated on the user actively being on the /booking/time page.
  useEffect(() => {
    if (!salon?.id || !date || !assignmentResult?.barberId || location.pathname !== "/booking/time") return;

    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("bookings" as any)
        .select("booking_time")
        .eq("salon_id", salon.id)
        .eq("stylist_id", assignmentResult.barberId)
        .eq("booking_date", date)
        .in("status", ["pending", "waiting", "in_progress"]);
      const booked = new Set((data || []).map((b: any) => b.booking_time).filter(Boolean));
      setBookedSlots((prev) => (booked.size !== prev.size ? booked : prev));
    }, 3000);

    return () => clearInterval(interval);
  }, [salon?.id, date, assignmentResult?.barberId, location.pathname]);

  const saveProfile = (draft: { firstName: string; lastName: string; phone: string }) => {
    const nextProfile = {
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim(),
      phone: draft.phone.trim(),
      altPhone: "",
      notes: "",
    };
    if (!nextProfile.firstName || !nextProfile.lastName || !nextProfile.phone) {
      toast.error("Please complete first name, last name, and phone");
      return;
    }
    window.localStorage.setItem(CUSTOMER_PROFILE_STORAGE_KEY, JSON.stringify(nextProfile));
    setSavedProfile(nextProfile);
    setCustomer((prev) => ({ ...prev, ...nextProfile }));
    setHasSavedProfile(true);
    toast.success("Profile saved");
  };

  // Only defer to the saved profile once one actually exists — otherwise (first-time users)
  // spreading the still-empty savedProfile defaults after `customer` would blank out
  // whatever the user just typed into the inline form.
  const activeCustomer = bookingForSomeoneElse || !hasSavedProfile ? customer : { ...customer, ...savedProfile };

  const resetCaptcha = () => {
    setCaptchaToken(null);
    turnstileRef.current?.reset();
  };

  const goToStep = (stepKey: (typeof BOOKING_STEPS)[number]["key"]) => {
    const step = BOOKING_STEPS.find((s) => s.key === stepKey);
    if (step) navigate(step.path);
  };

  const submitBooking = async () => {
    if (!salon || booking || verifyingCaptcha) return;

    if (
      selectedServices.length === 0 ||
      !date ||
      !time ||
      !activeCustomer.firstName.trim() ||
      !activeCustomer.lastName.trim() ||
      !activeCustomer.phone.trim()
    ) {
      toast.error("Please fill all booking details");
      return;
    }

    const minDate = getMinDate();
    const maxDate = getMaxDate();
    if (date < minDate || date > maxDate) {
      toast.error("Booking must be within 30 days");
      return;
    }

    if (!assignmentResult?.barberId) {
      toast.error("Stylist assignment is still in progress. Please wait...");
      return;
    }

    if (bookedSlots.has(time)) {
      toast.error("❌ This time slot was just booked! Another customer is faster. Please choose a different time.");
      return;
    }

    const totalDuration = selectedServices.reduce((sum, s) => sum + (s.duration || 30), 0);
    const totalPrice = selectedServices.reduce((sum, s) => sum + (s.price || 0), 0);
    const serviceNames = selectedServices.map((s) => s.name).join(", ");

    setVerifyingCaptcha(true);

    try {
      const token = turnstileRef.current?.getResponse() || "";
      if (!token) {
        toast.error("Invalid or expired captcha");
        resetCaptcha();
        setVerifyingCaptcha(false);
        return;
      }

      const captchaResult = await verifyTurnstileToken(token);
      if (!captchaResult.success) {
        toast.error(captchaResult.message || "Captcha verification failed");
        resetCaptcha();
        setVerifyingCaptcha(false);
        return;
      }

      resetCaptcha();
      setVerifyingCaptcha(false);
      setBooking(true);

      const { data: latestBookings } = await supabase
        .from("bookings" as any)
        .select("booking_time")
        .eq("salon_id", salon.id)
        .eq("stylist_id", assignmentResult.barberId)
        .eq("booking_date", date)
        .in("status", ["pending", "waiting", "in_progress"]);

      const latestBooked = new Set((latestBookings || []).map((b: any) => b.booking_time).filter(Boolean));
      if (latestBooked.has(time)) {
        setBookedSlots(latestBooked);
        setBooking(false);
        toast.error("⏱️ Just missed it! Someone booked this slot during verification. Refreshing available times...");
        return;
      }

      const sessionStatus = await verifySession();
      if (!sessionStatus.isValid || !sessionStatus.user) {
        setBooking(false);
        toast.error("Your session has expired. Please log in again to book.");
        setTimeout(() => {
          localStorage.removeItem("snippet_customer_profile");
          window.location.href = "/login";
        }, 2000);
        return;
      }

      const currentUser = sessionStatus.user;

      const { data: conflictCheck } = await supabase
        .from("bookings" as any)
        .select("id")
        .eq("salon_id", salon.id)
        .eq("stylist_id", assignmentResult.barberId)
        .eq("booking_date", date)
        .eq("booking_time", time)
        .in("status", ["pending", "waiting", "in_progress"])
        .limit(1)
        .maybeSingle();

      if (conflictCheck) {
        setBooking(false);
        setBookedSlots((prev) => new Set([...prev, time]));
        toast.error("⏱️ This slot was just booked by another customer! Refreshing times...");
        return;
      }

      const { data: latestQueueEntry } = await supabase
        .from("bookings" as any)
        .select("position")
        .eq("salon_id", salon.id)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextPosition = Number(latestQueueEntry?.position || 0) + 1;
      const createdAt = new Date().toISOString();
      const arrivalOTP = generateOTP();

      const bookingPayload: any = {
        user_id: user?.id || currentUser.id,
        customer_id: user?.id || currentUser.id,
        salon_id: salon?.id || null,
        service_id: selectedServices[0]?.id || null,
        barber_id: assignmentResult?.barberId || null,
        status: "pending",
        position: Number(nextPosition),
        created_at: createdAt,
        customer_first_name: activeCustomer.firstName?.trim() || null,
        customer_last_name: activeCustomer.lastName?.trim() || null,
        customer_phone: activeCustomer.phone?.trim() || null,
        contact_phone: activeCustomer.phone ? `+91${activeCustomer.phone.replace(/\D/g, "").slice(-10)}` : null,
        alt_phone: activeCustomer.altPhone?.trim() ? `+91${activeCustomer.altPhone.replace(/\D/g, "").slice(-10)}` : null,
        notes: customer.notes?.trim() || null,
        booking_date: date || null,
        time_slot: time || null,
        booking_time: time || null,
        arrival_otp: String(arrivalOTP || "").padStart(4, "0"),
        total_duration: Number(totalDuration) || 0,
        total_price: Number(totalPrice) || 0,
        service_count: Number(selectedServices.length) || 1,
        services_count: Number(selectedServices.length) || 1,
        is_multi_service: selectedServices.length > 1,
        selected_services: (selectedServices || []).map((s) => ({ id: s.id, name: s.name, duration: s.duration, price: s.price })),
      };

      if (!bookingPayload.salon_id) {
        toast.error("Internal error: salon not selected");
        setBooking(false);
        return;
      }
      if (!bookingPayload.customer_phone) {
        toast.error("Please provide a valid phone number");
        setBooking(false);
        return;
      }
      if (bookingPayload.booking_date && !/^\d{4}-\d{2}-\d{2}$/.test(bookingPayload.booking_date)) {
        const parsed = new Date(bookingPayload.booking_date);
        bookingPayload.booking_date = isNaN(parsed.getTime()) ? null : parsed.toISOString().split("T")[0];
      }
      if (bookingPayload.booking_time && !/^\d{2}:\d{2}:\d{2}$/.test(bookingPayload.booking_time)) {
        if (/^\d{2}:\d{2}$/.test(bookingPayload.booking_time)) {
          bookingPayload.booking_time = `${bookingPayload.booking_time}:00`;
          bookingPayload.time_slot = bookingPayload.booking_time;
        } else {
          bookingPayload.booking_time = null;
        }
      }
      if (bookingPayload.arrival_otp && String(bookingPayload.arrival_otp).length !== 4) {
        bookingPayload.arrival_otp = String(bookingPayload.arrival_otp).slice(0, 4).padStart(4, "0");
      }
      if (!Array.isArray(bookingPayload.selected_services)) bookingPayload.selected_services = [];

      const bookingsPayload: any = {
        customer_id: bookingPayload.customer_id || bookingPayload.user_id,
        salon_id: bookingPayload.salon_id,
        service_id: bookingPayload.service_id,
        stylist_id: bookingPayload.barber_id,
        status: "waiting",
        position: bookingPayload.position,
        created_at: bookingPayload.created_at,
        booking_date: bookingPayload.booking_date,
        booking_time: bookingPayload.booking_time,
        otp: bookingPayload.arrival_otp,
        queue_position: bookingPayload.position,
      };
      Object.keys(bookingsPayload).forEach((k) => {
        if (bookingsPayload[k] === undefined) bookingsPayload[k] = null;
      });
      const sanitizedPayload = Object.fromEntries(Object.entries(bookingsPayload).filter(([, v]) => v !== undefined));

      const { data: insertedData, error } = await (supabase.from("bookings") as any).insert(sanitizedPayload).select().single();

      if (error) {
        const parsedError = parseBookingError(error);
        if (parsedError.isAuthError) {
          toast.error("Your session has expired. Please log in again.");
          setTimeout(() => {
            localStorage.removeItem("snippet_customer_profile");
            window.location.href = "/login";
          }, 2000);
        } else if (parsedError.isRLSError) {
          toast.error("Permission denied - this is a system error. Please refresh and try again.");
        } else {
          toast.error(parsedError.userFacingMessage);
        }
        handleBookingError(error as any, async () => {
          if (!date || !assignmentResult?.barberId) return;
          const { data } = await supabase
            .from("bookings" as any)
            .select("booking_time")
            .eq("salon_id", salon.id)
            .eq("stylist_id", assignmentResult.barberId)
            .eq("booking_date", date)
            .in("status", ["pending", "waiting", "in_progress", "confirmed"]);
          setBookedSlots(new Set((data || []).map((b: any) => b.booking_time).filter(Boolean)));
        });
        setBooking(false);
        return;
      }

      const customerEmail = currentUser.email || user?.email;
      if (customerEmail && insertedData) {
        try {
          const { data: ownerData } = await supabase.from("owners").select("email").eq("id", salon.owner_id).maybeSingle();
          const [hours, minutes] = time.split(":");
          const hour = parseInt(hours);
          const ampm = hour >= 12 ? "PM" : "AM";
          const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
          const displayTime = `${displayHour}:${minutes} ${ampm}`;

          await sendBookingEmail("booking_confirmed", {
            bookingId: insertedData.id,
            salonId: salon?.id,
            salonName: salon?.name ?? "Unknown Salon",
            salonAddress: salon?.address || salon?.location || "",
            customerName: `${activeCustomer?.firstName ?? ""} ${activeCustomer?.lastName ?? ""}`.trim() || "Customer",
            customerEmail,
            customerPhone: activeCustomer?.phone,
            ownerEmail: ownerData?.email || "",
            serviceName: serviceNames,
            barberName: assignmentResult?.barberName || "",
            bookingDate: date,
            timeSlot: displayTime,
            amount: totalPrice,
            arrivalOTP: arrivalOTP,
          });
        } catch {
          // don't fail the booking if email fails
        }
      }

      if (bookingForSomeoneElse) {
        setCustomer((prev) => ({ ...prev, firstName: "", lastName: "", phone: "" }));
      }

      setConfirmedBookingState({
        salonName: salon?.name ?? "Unknown Salon",
        serviceName: serviceNames,
        address: salon?.address || salon?.location || "",
        image: salon?.image_url || "",
        estimatedWait: `${assignmentResult?.estimatedWait || 15} min`,
        queuePosition: nextPosition,
        bookingId: insertedData.id,
        arrivalOTP: arrivalOTP,
      });
      setBooking(false);
      sessionStorage.removeItem(BOOKING_SALON_ID_KEY);
      sessionStorage.removeItem(BOOKING_DRAFT_KEY);
    } catch (err: any) {
      toast.error(err?.message || "Failed to join queue");
      setBooking(false);
      setVerifyingCaptcha(false);
    }
  };

  const value = useMemo<BookingDraftContextValue>(
    () => ({
      loadingSalon,
      salon,
      services,
      barbers,
      selectedServices,
      setSelectedServices,
      assignmentResult,
      isAssigning,
      assignmentError,
      allBarbers,
      triggerAssignment,
      handleBarberChange,
      date,
      setDate,
      time,
      setTime,
      timeLabel,
      setTimeLabel,
      nextQueuePosition,
      customer,
      setCustomer,
      hasSavedProfile,
      savedProfile,
      bookingForSomeoneElse,
      setBookingForSomeoneElse,
      saveProfile,
      activeCustomer,
      bookedSlots,
      turnstileRef,
      captchaToken,
      setCaptchaToken,
      booking,
      verifyingCaptcha,
      confirmedBookingState,
      submitBooking,
      goToStep,
      exitFlow,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      loadingSalon, salon, services, barbers, selectedServices, assignmentResult, isAssigning,
      assignmentError, allBarbers, date, time, timeLabel, nextQueuePosition, customer, hasSavedProfile,
      savedProfile, bookingForSomeoneElse, activeCustomer, bookedSlots, captchaToken, booking,
      verifyingCaptcha, confirmedBookingState,
    ]
  );

  return <BookingDraftContext.Provider value={value}><Outlet /></BookingDraftContext.Provider>;
}

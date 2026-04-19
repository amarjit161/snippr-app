import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, Calendar, Check, Clock, DollarSign, Loader2, MapPin, Navigation, Star, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useGeolocation, estimateTravelMinutes } from "@/hooks/useGeolocation";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { pageFade, modalMotion } from "@/lib/motion";
import type { Tables } from "@/integrations/supabase/types";
import TurnstileCaptcha, { type TurnstileCaptchaHandle } from "@/components/TurnstileCaptcha";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { SlotPicker } from "@/components/booking/SlotPicker";
import { sendBookingEmail } from "@/services/emailService";

import salon1 from "@/assets/salon-1.jpg";
import salon2 from "@/assets/salon-2.jpg";
import salon3 from "@/assets/salon-3.jpg";
import salon4 from "@/assets/salon-4.jpg";

const CUSTOMER_PROFILE_STORAGE_KEY = "snippr_customer_profile";

const salonImages: Record<string, string> = {
  "/salon-1": salon1,
  "/salon-2": salon2,
  "/salon-3": salon3,
  "/salon-4": salon4,
};

interface SalonDetailProps {
  salon: Tables<"salons">;
  onBack: () => void;
  onJoined: () => void;
}

// Generate 30-minute time slots from 10:00 AM to 9:00 PM
const generateTimeSlots = (): string[] => {
  const slots: string[] = [];
  let hours = 10;
  let minutes = 0;

  while (hours < 21 || (hours === 21 && minutes === 0)) {
    const period = hours >= 12 ? "PM" : "AM";
    const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    const timeStr = `${String(displayHours).padStart(2, " ")}:${String(minutes).padStart(2, "0")} ${period}`;
    slots.push(timeStr);

    minutes += 30;
    if (minutes === 60) {
      minutes = 0;
      hours += 1;
    }
  }

  return slots;
};

const TIME_SLOTS = generateTimeSlots();

type BarberRow = {
  id: string;
  name: string;
  chair_number: number | null;
  specialization: string | null;
};

type CustomerProfile = {
  firstName: string;
  lastName: string;
  phone: string;
  altPhone?: string;
};

const EMPTY_PROFILE: CustomerProfile = {
  firstName: "",
  lastName: "",
  phone: "",
};

export default function SalonDetail({ salon, onBack, onJoined }: SalonDetailProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { handleBookingError } = useErrorHandler();
  const { location } = useGeolocation();
  const [services, setServices] = useState<Tables<"services">[]>([]);
  const [barbers, setBarbers] = useState<BarberRow[]>([]);
  const [selectedService, setSelectedService] = useState<Tables<"services"> | null>(null);
  const [selectedBarberId, setSelectedBarberId] = useState<string>("");
  const [customer, setCustomer] = useState({ firstName: "", lastName: "", phone: "", altPhone: "", notes: "" });
  const [savedProfile, setSavedProfile] = useState<CustomerProfile>(EMPTY_PROFILE);
  const [profileDraft, setProfileDraft] = useState<CustomerProfile>(EMPTY_PROFILE);
  const [hasSavedProfile, setHasSavedProfile] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [bookingForSomeoneElse, setBookingForSomeoneElse] = useState(false);
  const [touched, setTouched] = useState({ firstName: false, lastName: false, phone: false });
  const [date, setDate] = useState("");
  const [time, setTime] = useState(""); // HH:MM:SS format (set by SlotPicker)
  const [nextQueuePosition, setNextQueuePosition] = useState<number | null>(null);
  const [myQueuePosition, setMyQueuePosition] = useState<number | null>(null);
  const [booking, setBooking] = useState(false);
  const [verifyingCaptcha, setVerifyingCaptcha] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [bookedSlots, setBookedSlots] = useState<Set<string>>(new Set());
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [lastAvailabilityUpdate, setLastAvailabilityUpdate] = useState<Date | null>(null);
  const turnstileRef = useRef<TurnstileCaptchaHandle | null>(null);
  const firstNameInputRef = useRef<HTMLInputElement | null>(null);

  const handleBack = () => {
    const salonId = salon?.id;
    if (salonId) {
      navigate(`/salon/${salonId}`);
      return;
    }
    onBack();
  };

  useEffect(() => {
    supabase
      .from("services")
      .select("*")
      .eq("salon_id", salon.id)
      .then(({ data }) => setServices(data || []));
  }, [salon.id]);

  useEffect(() => {
    const checkOwnerBooking = async () => {
      const salonId = salon?.id;
      if (!salonId) return;

      const currentUser = user;
      if (!currentUser) return;

      const { data: ownedSalon } = await supabase
        .from("salons")
        .select("id")
        .eq("owner_id", currentUser.id)
        .eq("id", salonId)
        .maybeSingle();

      if (ownedSalon) {
        toast.error("You can't book your own salon 😄");
        navigate(`/salon/${salonId}`);
      }
    };

    checkOwnerBooking();
  }, [salon?.id, navigate]);

  useEffect(() => {
    const loadBarbers = async () => {
      const { data } = await supabase
        .from("barbers" as any)
        .select("id, name, chair_number, specialization")
        .eq("salon_id", salon.id)
        .order("name");

      const nextBarbers = (data || []) as any as BarberRow[];
      setBarbers(nextBarbers);
      setSelectedBarberId((current) => current || nextBarbers[0]?.id || "");
    };

    loadBarbers();
  }, [salon.id]);

  useEffect(() => {
    firstNameInputRef.current?.focus();
  }, [bookingForSomeoneElse]);

  useEffect(() => {
    setTime("");
  }, [date, selectedBarberId]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const rawProfile = window.localStorage.getItem(CUSTOMER_PROFILE_STORAGE_KEY);
      if (!rawProfile) return;

      const parsed = JSON.parse(rawProfile) as { firstName?: string; lastName?: string; phone?: string };
      const profile = {
        firstName: (parsed.firstName || "").trim(),
        lastName: (parsed.lastName || "").trim(),
        phone: (parsed.phone || "").trim(),
      };

      if (!profile.firstName || !profile.phone) return;

      setSavedProfile(profile);
      setProfileDraft(profile);
      setHasSavedProfile(true);
      setCustomer((prev) => ({ ...prev, ...profile }));
    } catch {
      // Ignore invalid localStorage values and continue with empty state.
    }
  }, []);

  useEffect(() => {
    if (!hasSavedProfile) {
      setProfileModalOpen(true);
    }
  }, [hasSavedProfile]);

  useEffect(() => {
    const fetchNextPosition = async () => {
      const { data } = await (supabase
        .from("queue" as any) as any)
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queue", filter: `salon_id=eq.${salon.id}` },
        () => fetchNextPosition()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [salon.id]);

  // CHECK AVAILABILITY - Real-time slot booking status
  useEffect(() => {
    if (!date || !selectedBarberId) return;

    const checkAvailability = async () => {
      setCheckingAvailability(true);
      try {
        const { data } = await supabase
          .from("queue" as any)
          .select("time_slot")
          .eq("salon_id", salon.id)
          .eq("barber_id", selectedBarberId)
          .eq("booking_date", date)
          .in("status", ["waiting", "in_progress"]);

        const booked = new Set((data || []).map((b: any) => b.time_slot));
        console.log(`✅ AVAILABILITY_CHECK: ${TIME_SLOTS.length - booked.size}/${TIME_SLOTS.length} slots available for ${date}`, {
          bookedSlots: Array.from(booked),
          barber: selectedBarberId
        });
        setBookedSlots(booked);
        setLastAvailabilityUpdate(new Date());
      } catch (error) {
        console.error("❌ AVAILABILITY_CHECK_FAILED:", error);
      } finally {
        setCheckingAvailability(false);
      }
    };

    checkAvailability();

    // REAL-TIME UPDATES - Listen for ALL queue changes and refresh
    const subscription = supabase
      .channel(`bookings-${salon.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "queue",
          // NO FILTER - catch all changes and check availability
        },
        (payload) => {
          // Only refresh if it's for THIS salon and date
          if (payload.new?.salon_id === salon.id || payload.old?.salon_id === salon.id) {
            console.log("🔄 REAL_TIME_UPDATE: A booking changed", {
              eventType: payload.eventType,
              newData: payload.new?.booking_date,
              oldData: payload.old?.booking_date
            });
            // Refresh availability for current selections
            if (date && selectedBarberId) {
              console.log("🔁 REFRESHING availability due to real-time event");
              checkAvailability();
            }
          }
        }
      )
      .subscribe((status) => {
        console.log(`📡 SUBSCRIPTION_STATUS: ${status}`, { 
          salonId: salon.id,
          date, 
          barberId: selectedBarberId 
        });
      });

    return () => {
      subscription.unsubscribe();
    };
  }, [date, selectedBarberId, salon.id]);

  // PERIODIC REFRESH - Fallback if real-time doesn't work (check every 3 seconds while booking)
  useEffect(() => {
    if (!date || !selectedBarberId || currentStep !== 4) return;

    const interval = setInterval(async () => {
      try {
        const { data } = await supabase
          .from("queue" as any)
          .select("time_slot")
          .eq("salon_id", salon.id)
          .eq("barber_id", selectedBarberId)
          .eq("booking_date", date)
          .in("status", ["waiting", "in_progress"]);

        const booked = new Set((data || []).map((b: any) => b.time_slot));
        
        // If availability changed, update silently (don't spam logs)
        if (booked.size !== bookedSlots.size) {
          console.log(`🔃 PERIODIC_REFRESH: Availability changed from ${TIME_SLOTS.length - bookedSlots.size} to ${TIME_SLOTS.length - booked.size}`);
          setBookedSlots(booked);
          setLastAvailabilityUpdate(new Date());
        }
      } catch (error) {
        console.error("❌ PERIODIC_REFRESH_FAILED:", error);
      }
    }, 3000); // Check every 3 seconds

    return () => clearInterval(interval);
  }, [date, selectedBarberId, salon.id, currentStep, bookedSlots.size]);

  const travelMin = location && salon.lat && salon.lng
    ? estimateTravelMinutes(location.lat, location.lng, salon.lat, salon.lng)
    : 10;

  const selectedBarber = barbers.find((barber) => barber.id === selectedBarberId) || null;
  const estimatedWait = selectedService ? `${Math.max(10, Math.ceil(selectedService.duration * 0.75))} min` : "Select a service";
  const activeCustomer = bookingForSomeoneElse ? customer : { ...customer, ...savedProfile };
  const customerName = `${activeCustomer.firstName.trim()} ${activeCustomer.lastName.trim()}`.trim();
  const firstNameError = touched.firstName && !activeCustomer.firstName.trim() ? "First name is required" : "";
  const lastNameError = touched.lastName && !activeCustomer.lastName.trim() ? "Last name is required" : "";
  const phoneError = touched.phone && !activeCustomer.phone.trim() ? "Phone number is required" : "";

  const isAdvanceBooking = date ? new Date(date) > new Date(new Date().setHours(23, 59, 59, 999)) : false;
  const bookingTypeLabel = isAdvanceBooking ? "Scheduled Booking" : "Live Queue";

  const getMinDate = (): string => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  };

  const getMaxDate = (): string => {
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 30);
    return maxDate.toISOString().split("T")[0];
  };

  const saveProfile = () => {
    const nextProfile = {
      firstName: profileDraft.firstName.trim(),
      lastName: profileDraft.lastName.trim(),
      phone: profileDraft.phone.trim(),
    };

    if (!nextProfile.firstName || !nextProfile.lastName || !nextProfile.phone) {
      toast.error("Please complete first name, last name, and phone");
      return;
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem(CUSTOMER_PROFILE_STORAGE_KEY, JSON.stringify(nextProfile));
    }

    setSavedProfile(nextProfile);
    setCustomer((prev) => ({ ...prev, ...nextProfile }));
    setHasSavedProfile(true);
    setProfileModalOpen(false);
    toast.success("Profile saved");
  };

  const resetCaptcha = () => {
    setCaptchaToken(null);
    turnstileRef.current?.reset();
  };

  const refreshAvailability = async () => {
    if (!date || !selectedBarberId) return;

    const { data } = await supabase
      .from("queue" as any)
      .select("time_slot")
      .eq("salon_id", salon.id)
      .eq("barber_id", selectedBarberId)
      .eq("booking_date", date)
      .in("status", ["waiting", "in_progress", "confirmed"]);

    const booked = new Set((data || []).map((b: any) => b.time_slot).filter(Boolean));
    setBookedSlots(booked);
    setLastAvailabilityUpdate(new Date());
  };

  const handleBook = async () => {
    if (booking || verifyingCaptcha) return;

    setTouched({ firstName: true, lastName: true, phone: true });

    if (!selectedService || !date || !time || !activeCustomer.firstName.trim() || !activeCustomer.lastName.trim() || !activeCustomer.phone.trim()) {
      toast.error("Please fill all booking details");
      return;
    }

    const minDate = getMinDate();
    const maxDate = getMaxDate();

    if (date < minDate || date > maxDate) {
      toast.error("Booking must be within 30 days");
      return;
    }

    if (!selectedBarberId) {
      toast.error("Please select a barber");
      return;
    }

    // CHECK AVAILABILITY BEFORE CAPTCHA
    if (bookedSlots.has(time)) {
      toast.error("❌ This time slot was just booked! Another customer is faster. Please choose a different time.");
      return;
    }

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

      // FINAL SAFETY CHECK - Refresh availability one last time before booking
      console.log("🔒 FINAL_CHECK: Refreshing availability before booking...");
      const { data: latestBookings } = await supabase
        .from("queue" as any)
        .select("time_slot")
        .eq("salon_id", salon.id)
        .eq("barber_id", selectedBarberId)
        .eq("booking_date", date)
        .in("status", ["waiting", "in_progress"]);

      const latestBooked = new Set((latestBookings || []).map((b: any) => b.time_slot).filter(Boolean));
      if (latestBooked.has(time)) {
        console.log("🚫 FINAL_CHECK: Slot was just booked during captcha!");
        setBookedSlots(latestBooked);
        setLastAvailabilityUpdate(new Date());
        setBooking(false);
        toast.error("⏱️ Just missed it! Someone booked this slot during verification. Refreshing available times...");
        return;
      }

      // Always resolve authenticated user before queue checks/inserts (RLS-safe).
      const currentUser = user;

      if (!currentUser) {
        setBooking(false);
        throw new Error("You must be logged in to join the queue.");
      }

      console.log("RLS_AUTH_VERIFIED", currentUser.id);

      // Prevent multiple active bookings for the same user across salons.
      const { data: existingActiveBooking } = await supabase
        .from("queue" as any)
        .select("id, salon_id")
        .eq("user_id", currentUser.id)
        .in("status", ["waiting", "in_progress"])
        .limit(1)
        .maybeSingle();

      if (existingActiveBooking) {
        setBooking(false);
        toast.error("You already have an active queue booking. Cancel it before booking again.");
        return;
      }

      // Now do the original conflict check
      const { data: conflictCheck } = await supabase
        .from("queue" as any)
        .select("id")
        .eq("salon_id", salon.id)
        .eq("barber_id", selectedBarberId)
        .eq("booking_date", date)
        .eq("time_slot", time)
        .in("status", ["waiting", "in_progress"])
        .limit(1)
        .maybeSingle();

      if (conflictCheck) {
        setBooking(false);
        // Update booked slots immediately to reflect the change
        setBookedSlots((prev) => new Set([...prev, time]));
        toast.error("⏱️ This slot was just booked by another customer! Refreshing times...");
        return;
      }

      const { data: latestQueueEntry } = await supabase
        .from("queue" as any)
        .select("position")
        .eq("salon_id", salon.id)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextPosition = Number(latestQueueEntry?.position || 0) + 1;
      const createdAt = new Date().toISOString();

      const { data: insertedData, error } = await (supabase.from("queue") as any).insert({
        user_id: user?.id || currentUser.id,
        salon_id: salon.id,
        service_id: selectedService.id,
        barber_id: selectedBarberId,
        status: "waiting",
        position: nextPosition,
        created_at: createdAt,
        customer_first_name: activeCustomer.firstName.trim(),
        customer_last_name: activeCustomer.lastName.trim(),
        customer_phone: activeCustomer.phone.trim(),
        contact_phone: activeCustomer.phone.trim() ? `+91${activeCustomer.phone.replace(/\D/g,'').slice(-10)}` : null,
        alt_phone: activeCustomer.altPhone?.trim() ? `+91${activeCustomer.altPhone.replace(/\D/g,'').slice(-10)}` : null,
        notes: customer.notes.trim() || null,
        booking_date: date,
        time_slot: time,
      }).select().single();

      if (error) {
        handleBookingError(error as any, refreshAvailability);
        setBooking(false);
        return;
      } else {
        const customerEmail = currentUser.email || user?.email;
        
        // Send booking confirmation email
        if (customerEmail && insertedData) {
          try {
            // Get owner email
            const { data: ownerData } = await supabase
              .from("owners")
              .select("email")
              .eq("id", salon.owner_id)
              .maybeSingle();

            const [hours, minutes] = time.split(':');
            const hour = parseInt(hours);
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
            const displayTime = `${displayHour}:${minutes} ${ampm}`;

            await sendBookingEmail('booking_confirmed', {
              bookingId: insertedData.id,
              salonId: salon.id,
              salonName: salon.name,
              salonAddress: salon.address || salon.location || '',
              customerName: `${activeCustomer.firstName} ${activeCustomer.lastName}`.trim() || 'Customer',
              customerEmail,
              customerPhone: activeCustomer.phone,
              ownerEmail: ownerData?.email || '',
              serviceName: selectedService.name,
              barberName: '', // We could fetch this if needed
              bookingDate: date,
              timeSlot: displayTime,
              amount: selectedService.price || 0,
            });
          } catch (emailErr) {
            console.warn("❌ BOOKING_EMAIL_FAILED", emailErr);
            // Don't fail the booking if email fails
          }
        }

        if (bookingForSomeoneElse) {
          setCustomer((prev) => ({ ...prev, firstName: "", lastName: "", phone: "" }));
        }

        setMyQueuePosition(nextPosition);
        
        // Format time from HH:MM:SS to 12-hour format
        const [hours, minutes] = time.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
        const displayTime = `${displayHour}:${minutes} ${ampm}`;
        
        const successMsg = isAdvanceBooking
          ? `Booking confirmed for ${date} at ${displayTime}.`
          : `Booking successful. Your Token Number: #${nextPosition}`;
        toast.success(successMsg);
        onJoined();
        setBooking(false);
      }
    } catch (err: any) {
      console.error("BOOKING_ERROR", err);
      toast.error(err.message || "Failed to join queue");
      setBooking(false);
      setVerifyingCaptcha(false);
    }
  };

  return (
    <motion.div initial="hidden" animate="visible" variants={pageFade} className="min-h-screen bg-[#faf9fc] text-[#1a1c1e]">
      <div className="mx-auto w-full px-3 pb-20 pt-12 sm:px-4 md:px-6 lg:px-8 xl:px-0 xl:max-w-7xl">
        <div className="grid grid-cols-1 items-start gap-4 md:gap-6 lg:gap-8 lg:grid-cols-12">
          {/* FORM SECTION */}
          <div className="space-y-5 md:space-y-6 lg:col-span-12">
            {/* HEADER */}
            <header className="space-y-2 sm:space-y-3 md:space-y-4">
              <button
                onClick={handleBack}
                className="mb-4 flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
              >
                <ChevronLeft className="h-4 w-4" />
                Back to salon
              </button>
              <div className="space-y-1 sm:space-y-2">
                <h1 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold leading-[1.05] tracking-tight">
                  Craft Your
                  <br />
                  <span className="bg-gradient-to-r from-[#4f378a] to-[#6750a4] bg-clip-text text-transparent">Perfect Look.</span>
                </h1>
                <p className="max-w-md text-sm sm:text-base md:text-lg text-[#494551]">
                  Enter your details below to join the live queue at <span className="font-semibold text-[#1a1c1e]">{salon.name}</span>.
                </p>
              </div>
            </header>

            {/* PROGRESS INDICATOR */}
            <div className="flex gap-1.5 sm:gap-2">
              {[1, 2, 3, 4].map((step) => (
                <div key={step} className="flex-1 h-1.5 sm:h-2 rounded-full transition-colors" style={{
                  backgroundColor: step <= currentStep ? '#4f378a' : '#e3e2e5'
                }} />
              ))}
            </div>

            {/* STEP 1: INFORMATION */}
            {currentStep === 1 && (
              <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 sm:space-y-5 md:space-y-6 rounded-xl sm:rounded-2xl bg-[#f4f3f6] p-4 sm:p-6 md:p-8 lg:p-10">
                <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
                  <span className="flex h-8 sm:h-9 md:h-10 w-8 sm:w-9 md:w-10 items-center justify-center rounded-full bg-[#4f378a] text-xs font-bold text-white">1</span>
                  <h2 className="font-display text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold">Your Information</h2>
                </div>
                <div className="space-y-4 sm:space-y-5 md:space-y-6">
                  <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 md:gap-5 lg:gap-6">
                    <div>
                      <label className="mb-2 block text-xs sm:text-sm font-semibold text-[#4f378a]">Full Name</label>
                      <Input
                        ref={firstNameInputRef}
                        value={`${activeCustomer.firstName} ${activeCustomer.lastName}`.trim() || ""}
                        onChange={(event) => {
                          const [first, ...last] = event.target.value.trim().split(" ");
                          setCustomer((prev) => ({ ...prev, firstName: first || "", lastName: last.join(" ") }));
                        }}
                        onBlur={() => setTouched((prev) => ({ ...prev, firstName: true, lastName: true }))}
                        placeholder="Johnathan Doe"
                        readOnly={!bookingForSomeoneElse && hasSavedProfile}
                        className="h-10 sm:h-11 md:h-12 rounded-lg border-2 border-[#cbc4d2] bg-white px-3 sm:px-4 text-sm sm:text-base placeholder:text-slate-300 focus-visible:ring-2 focus-visible:ring-[#6750a4]/20"
                      />
                      {(firstNameError || lastNameError) ? <p className="mt-1 text-xs sm:text-sm text-red-600">{firstNameError || lastNameError}</p> : null}
                    </div>
                    <div>
                      <label className="mb-2 block text-xs sm:text-sm font-semibold text-[#4f378a]">Phone Number</label>
                      <Input
                        value={activeCustomer.phone}
                        onChange={(event) => setCustomer((prev) => ({ ...prev, phone: event.target.value }))}
                        onBlur={() => setTouched((prev) => ({ ...prev, phone: true }))}
                        placeholder="+91 98765 43210"
                        inputMode="tel"
                        readOnly={!bookingForSomeoneElse && hasSavedProfile}
                        className="h-10 sm:h-11 md:h-12 rounded-lg border-2 border-[#cbc4d2] bg-white px-3 sm:px-4 text-sm sm:text-base placeholder:text-slate-300 focus-visible:ring-2 focus-visible:ring-[#6750a4]/20"
                      />
                      {phoneError ? <p className="mt-1 text-xs sm:text-sm text-red-600">{phoneError}</p> : null}
                    </div>
                    <div>
                      <label className="mb-2 block text-xs sm:text-sm font-semibold text-[#7a7582]">Alternative Number <span className="text-gray-400">(Optional)</span></label>
                      <Input
                        value={activeCustomer.altPhone || ""}
                        onChange={(event) => setCustomer((prev) => ({ ...prev, altPhone: event.target.value }))}
                        placeholder="For salon to call if needed"
                        inputMode="tel"
                        className="h-10 sm:h-11 md:h-12 rounded-lg border-2 border-[#cbc4d2] bg-white px-3 sm:px-4 text-sm sm:text-base placeholder:text-slate-300 focus-visible:ring-2 focus-visible:ring-[#6750a4]/20"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-xs sm:text-sm font-semibold text-[#7a7582]">Notes (Optional)</label>
                    <textarea
                      value={customer.notes}
                      onChange={(event) => setCustomer((prev) => ({ ...prev, notes: event.target.value }))}
                      placeholder="Special requirements or hair history..."
                      rows={3}
                      className="w-full rounded-lg border-2 border-[#cbc4d2] bg-white px-3 sm:px-4 py-2 sm:py-3 text-sm placeholder:text-slate-300 focus:border-[#4f378a] focus:outline-none focus:ring-2 focus:ring-[#6750a4]/10"
                    />
                  </div>
                  {hasSavedProfile && (
                    <label className="flex cursor-pointer items-center gap-2 sm:gap-3 pt-1">
                      <input
                        type="checkbox"
                        checked={!bookingForSomeoneElse}
                        onChange={(e) => {
                          const next = !e.target.checked;
                          setBookingForSomeoneElse(next);
                          setTouched({ firstName: false, lastName: false, phone: false });
                          if (next) {
                            setCustomer((prev) => ({ ...prev, firstName: "", lastName: "", phone: "" }));
                          } else if (hasSavedProfile) {
                            setCustomer((prev) => ({ ...prev, ...savedProfile }));
                          }
                        }}
                        className="h-4 w-4 sm:h-5 sm:w-5 rounded-md border-[#cbc4d2] text-[#4f378a]"
                      />
                      <span className="text-sm sm:text-base font-medium text-[#494551]">Use saved profile</span>
                    </label>
                  )}
                </div>
              </motion.section>
            )}

            {/* STEP 2: SERVICE */}
            {currentStep === 2 && (
              <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 sm:space-y-5 md:space-y-6 rounded-xl sm:rounded-2xl bg-[#f4f3f6] p-4 sm:p-6 md:p-8 lg:p-10">
                <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
                  <span className="flex h-8 sm:h-9 md:h-10 w-8 sm:w-9 md:w-10 items-center justify-center rounded-full bg-[#4f378a] text-xs font-bold text-white">2</span>
                  <h2 className="font-display text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold">Select Service</h2>
                </div>
                {services.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[#cbc4d2] p-6 text-center text-[#494551]">No services available</div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:gap-5 lg:gap-6">
                    {services.map((svc) => (
                      <button
                        key={svc.id}
                        onClick={() => setSelectedService(svc)}
                        className={`rounded-lg sm:rounded-xl border-2 p-4 sm:p-5 md:p-6 text-left transition-all ${
                          selectedService?.id === svc.id
                            ? "border-[#4f378a] bg-[#f0e9ff]"
                            : "border-transparent bg-white shadow-sm hover:border-[#cbc4d2]"
                        }`}
                      >
                        <div className="mb-3 sm:mb-4 flex items-start justify-between gap-2">
                          <span className={`rounded-full px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider ${selectedService?.id === svc.id ? "bg-[#4f378a] text-white" : "bg-[#e3e2e5] text-[#494551]"}`}>
                            {selectedService?.id === svc.id ? "Selected" : "Standard"}
                          </span>
                          <span className="font-bold text-[#1a1c1e] text-sm sm:text-base">INR {svc.price}</span>
                        </div>
                        <p className="text-base sm:text-lg font-bold text-[#1a1c1e] mb-2">{svc.name}</p>
                        <div className="flex items-center gap-2 text-xs sm:text-sm text-[#494551]">
                          <Clock className="h-4 w-4" />
                          <span>{svc.duration} mins</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </motion.section>
            )}

            {/* STEP 3: BARBER */}
            {currentStep === 3 && (
              <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 sm:space-y-5 md:space-y-6 rounded-xl sm:rounded-2xl bg-[#f4f3f6] p-4 sm:p-6 md:p-8 lg:p-10">
                <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
                  <span className="flex h-8 sm:h-9 md:h-10 w-8 sm:w-9 md:w-10 items-center justify-center rounded-full bg-[#4f378a] text-xs font-bold text-white">3</span>
                  <h2 className="font-display text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold">Choose Barber</h2>
                </div>
                {barbers.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[#cbc4d2] p-6 text-center text-[#494551]">No barbers available right now</div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 md:gap-5 lg:gap-6">
                    {barbers.map((barber) => {
                      const selected = selectedBarberId === barber.id;
                      return (
                        <button
                          key={barber.id}
                          onClick={() => setSelectedBarberId(barber.id)}
                          className={`flex items-center gap-3 sm:gap-4 rounded-lg sm:rounded-xl border-2 p-4 sm:p-5 md:p-6 text-left transition-all ${selected ? "border-[#4f378a] bg-[#f0e9ff]" : "border-transparent bg-white shadow-sm hover:border-[#cbc4d2]"}`}
                        >
                          <div className={`flex h-12 sm:h-14 md:h-16 w-12 sm:w-14 md:w-16 flex-shrink-0 items-center justify-center rounded-full text-lg sm:text-xl md:text-2xl font-bold ${selected ? "bg-[#4f378a] text-white" : "bg-[#c9a74d] text-[#503d00]"}`}>
                            {barber.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <p className="truncate font-bold text-[#1a1c1e] text-sm sm:text-base">{barber.name}</p>
                              <span className="rounded-full px-2 sm:px-3 py-0.5 sm:py-1 text-xs font-bold uppercase tracking-wide text-green-700 bg-green-50 whitespace-nowrap">Online</span>
                            </div>
                            <p className="mb-1 text-xs text-[#494551]">Chair {barber.chair_number ?? 1}</p>
                            <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#1a1c1e]">
                              <Star className="h-3.5 sm:h-4 w-3.5 sm:w-4 fill-amber-500 text-amber-500" /> 4.9
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </motion.section>
            )}

            {/* STEP 4: TIME */}
            {currentStep === 4 && (
              <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5 sm:space-y-6 md:space-y-7 rounded-xl sm:rounded-2xl bg-[#f4f3f6] p-4 sm:p-6 md:p-8 lg:p-10">
                <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
                  <span className="flex h-8 sm:h-9 md:h-10 w-8 sm:w-9 md:w-10 items-center justify-center rounded-full bg-[#4f378a] text-xs font-bold text-white">4</span>
                  <h2 className="font-display text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold">Select Time</h2>
                </div>
                <div className="grid grid-cols-1 gap-5 sm:gap-6 md:grid-cols-2 md:gap-5 lg:gap-6">
                  <div className="space-y-2.5 sm:space-y-3">
                    <label className="block text-sm sm:text-base font-semibold text-[#4f378a]">Date</label>
                    <Input
                      type="date"
                      required
                      min={getMinDate()}
                      max={getMaxDate()}
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="h-11 sm:h-12 md:h-13 w-full rounded-lg border-2 border-[#cbc4d2] bg-white px-3 sm:px-4 text-sm sm:text-base text-[#1a1c1e] outline-none transition focus:border-[#4f378a] focus:ring-2 focus:ring-[#6750a4]/10"
                    />
                  </div>
                </div>

                <div className="space-y-2.5 sm:space-y-3">
                  <label className="block text-sm sm:text-base font-semibold text-[#4f378a]">Select Your Time</label>
                  {date && selectedBarberId ? (
                    <SlotPicker
                      key={`${selectedBarberId}-${date}`}
                      salonId={salon.id}
                      date={date}
                      barberId={selectedBarberId}
                      selectedSlot={time}
                      onSlotSelect={(timeValue) => setTime(timeValue)}
                    />
                  ) : (
                    <div className="rounded-lg bg-gray-50 border-2 border-gray-200 p-4 sm:p-5 text-center">
                      <p className="text-sm text-gray-600">👆 Please select a date and barber first</p>
                    </div>
                  )}
                </div>

                <div className="rounded-lg border-l-4 border-[#4f378a] bg-[#ede9f6] p-4 sm:p-5">
                  <p className="text-xs sm:text-sm font-semibold text-[#4f378a] mb-1.5">ℹ️ ADVANCE BOOKING</p>
                  <p className="text-sm text-[#494551] leading-relaxed">
                    Up to 30 days ahead. Your position in the live queue will be locked instantly once confirmed.
                  </p>
                </div>
              </motion.section>
            )}

            {/* NAVIGATION BUTTONS */}
            <div className="flex gap-2.5 sm:gap-3 pt-4 sm:pt-5 md:pt-6">
              {currentStep > 1 && (
                <button
                  onClick={() => setCurrentStep(currentStep - 1)}
                  className="flex-1 rounded-lg border-2 border-[#cbc4d2] py-3 sm:py-3.5 md:py-4 px-3 sm:px-4 md:px-6 font-semibold text-sm sm:text-base text-[#1a1c1e] transition hover:border-[#4f378a] hover:bg-[#f4f3f6]"
                >
                  Back
                </button>
              )}
              {currentStep < 4 && (
                <button
                  onClick={() => {
                    if (currentStep === 1 && (!activeCustomer.firstName || !activeCustomer.phone)) {
                      toast.error("Please fill in your details");
                      return;
                    }
                    if (currentStep === 2 && !selectedService) {
                      toast.error("Please select a service");
                      return;
                    }
                    if (currentStep === 3 && !selectedBarberId) {
                      toast.error("Please select a barber");
                      return;
                    }
                    setCurrentStep(currentStep + 1);
                  }}
                  className="flex-1 rounded-lg bg-[#4f378a] py-3 sm:py-3.5 md:py-4 px-3 sm:px-4 md:px-6 font-semibold text-sm sm:text-base text-white transition hover:bg-[#6750a4] active:scale-95"
                >
                  Next
                </button>
              )}
            </div>
          </div>

          {/* BOOKING CONFIRMATION CARD */}
          <aside className="w-full lg:col-span-12 mt-6 lg:mt-8">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br from-[#4f378a] to-[#6750a4] p-5 sm:p-7 md:p-8 lg:p-10 text-white shadow-2xl"
            >
              <div className="absolute -right-10 sm:-right-12 md:-right-16 -top-10 sm:-top-12 md:-top-16 h-32 sm:h-40 md:h-56 w-32 sm:w-40 md:w-56 rounded-full bg-[#fe6a34] opacity-20 blur-3xl" />
              <div className="relative z-10 space-y-5 sm:space-y-6 md:space-y-8">
                <header className="space-y-2 sm:space-y-3">
                  <div className="flex h-10 sm:h-11 md:h-12 lg:h-14 w-10 sm:w-11 md:w-12 lg:w-14 items-center justify-center rounded-full bg-white/20 backdrop-blur-md">
                    <Check className="h-5 sm:h-6 md:h-7 w-5 sm:w-6 md:w-7" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">BOOKING SUMMARY</p>
                    <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-extrabold leading-tight">Ready to join</h2>
                  </div>
                </header>

                <div className="space-y-1">
                  <div className="flex items-center justify-between border-b border-white/10 py-2.5 sm:py-3 md:py-4">
                    <span className="text-xs sm:text-sm font-medium text-white/60">Customer</span>
                    <span className="font-bold text-xs sm:text-sm md:text-base text-right">{customerName || "Enter name"}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-white/10 py-2.5 sm:py-3 md:py-4">
                    <span className="text-xs sm:text-sm font-medium text-white/60">Service</span>
                    <span className="font-bold text-xs sm:text-sm md:text-base text-right">{selectedService?.name || "Choose service"}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-white/10 py-2.5 sm:py-3 md:py-4">
                    <span className="text-xs sm:text-sm font-medium text-white/60">Barber</span>
                    <span className="font-bold text-xs sm:text-sm md:text-base text-right">{selectedBarber?.name || "Choose barber"}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:gap-4 pt-4 sm:pt-5 md:pt-6">
                    <div className="rounded-lg bg-white/10 p-3 sm:p-3.5 md:p-5 backdrop-blur-sm">
                      <p className="mb-1 sm:mb-1.5 text-xs text-white/60">Wait Time</p>
                      <p className="font-display text-lg sm:text-xl md:text-2xl font-bold">{estimatedWait}</p>
                    </div>
                    <div className="rounded-lg bg-white/10 p-3 sm:p-3.5 md:p-5 backdrop-blur-sm">
                      <p className="mb-1 sm:mb-1.5 text-xs text-white/60">Queue Position</p>
                      <p className="font-display text-lg sm:text-xl md:text-2xl font-bold">{myQueuePosition ? `#${myQueuePosition}` : `#${nextQueuePosition ?? "--"}`}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg bg-white/10 p-4 sm:p-4.5 md:p-6 backdrop-blur-sm">
                  <span className="text-sm sm:text-base font-bold text-white/80">Total Amount</span>
                  <div className="text-right">
                    <p className="font-display text-2xl sm:text-3xl md:text-4xl font-extrabold">INR {selectedService?.price || 0}</p>
                    <p className="text-[10px] sm:text-xs text-white/60">incl. all taxes</p>
                  </div>
                </div>

                <div className="space-y-3 sm:space-y-3.5">
                  {currentStep === 4 && (
                    <>
                      <div className="rounded-lg bg-white/20 p-5 sm:p-5 md:p-5 backdrop-blur-sm border border-white/30">
                        <p className="text-xs text-white/70 mb-3 font-semibold">Security Verification</p>
                        <div className="flex justify-center">
                          <TurnstileCaptcha ref={turnstileRef} onTokenChange={setCaptchaToken} theme="dark" className="w-full min-h-[130px] sm:min-h-[120px]" />
                        </div>
                      </div>
                      <button
                        onClick={handleBook}
                        disabled={!date || !selectedService || !time || booking || verifyingCaptcha || !captchaToken}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#ab3500] py-3 sm:py-3.5 md:py-4 px-4 sm:px-5 font-bold text-white shadow-lg shadow-[#ab3500]/20 transition hover:scale-[1.01] hover:bg-[#fe6a34] disabled:cursor-not-allowed disabled:opacity-50 active:scale-95 text-sm sm:text-base"
                      >
                        {booking ? (
                          <>
                            <Loader2 className="h-4 sm:h-5 w-4 sm:w-5 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          "Confirm Booking"
                        )}
                      </button>
                      <p className="px-3 sm:px-4 text-center text-[10px] sm:text-xs leading-relaxed text-white/40">
                        By joining the queue, you agree to our Terms of Service and Privacy Policy. Cancellation fees may apply within 2 hours of slot.
                      </p>
                    </>
                  )}
                  {currentStep < 4 && (
                    <p className="rounded-lg bg-white/10 px-3 sm:px-4 py-2.5 sm:py-3 text-center text-xs sm:text-sm font-semibold text-white/70">
                      Complete all steps to confirm booking
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          </aside>
        </div>
      </div>

      {/* Profile Modal */}
      {profileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <motion.div initial="hidden" animate="visible" variants={modalMotion} className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
            <h3 className="text-2xl font-bold text-gray-900">Create your profile</h3>
            <p className="mt-2 text-gray-600">Save your details once for faster booking next time.</p>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">First Name</label>
                <Input
                  value={profileDraft.firstName}
                  onChange={(e) => setProfileDraft((prev) => ({ ...prev, firstName: e.target.value }))}
                  placeholder="Your first name"
                  className="border-gray-200"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Last Name</label>
                <Input
                  value={profileDraft.lastName}
                  onChange={(e) => setProfileDraft((prev) => ({ ...prev, lastName: e.target.value }))}
                  placeholder="Your last name"
                  className="border-gray-200"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Phone</label>
                <Input
                  value={profileDraft.phone}
                  onChange={(e) => setProfileDraft((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="Your phone number"
                  inputMode="tel"
                  className="border-gray-200"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setProfileModalOpen(false)}
                className="flex-1 rounded-lg border border-gray-200 px-4 py-2 font-semibold text-gray-900 transition hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveProfile}
                className="flex-1 rounded-lg bg-orange-500 px-4 py-2 font-semibold text-white transition hover:bg-orange-600"
              >
                Save
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

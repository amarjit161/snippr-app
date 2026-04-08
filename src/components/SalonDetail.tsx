import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Calendar, Check, Clock, DollarSign, Loader2, MapPin, Navigation, Star, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useGeolocation, estimateTravelMinutes } from "@/hooks/useGeolocation";
import type { Tables } from "@/integrations/supabase/types";
import TurnstileCaptcha, { type TurnstileCaptchaHandle } from "@/components/TurnstileCaptcha";
import { verifyTurnstileToken } from "@/lib/turnstile";

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
};

const EMPTY_PROFILE: CustomerProfile = {
  firstName: "",
  lastName: "",
  phone: "",
};

export default function SalonDetail({ salon, onBack, onJoined }: SalonDetailProps) {
  const { user } = useAuth();
  const { location } = useGeolocation();
  const [services, setServices] = useState<Tables<"services">[]>([]);
  const [barbers, setBarbers] = useState<BarberRow[]>([]);
  const [selectedService, setSelectedService] = useState<Tables<"services"> | null>(null);
  const [selectedBarberId, setSelectedBarberId] = useState<string>("");
  const [customer, setCustomer] = useState({ firstName: "", lastName: "", phone: "", notes: "" });
  const [savedProfile, setSavedProfile] = useState<CustomerProfile>(EMPTY_PROFILE);
  const [profileDraft, setProfileDraft] = useState<CustomerProfile>(EMPTY_PROFILE);
  const [hasSavedProfile, setHasSavedProfile] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [bookingForSomeoneElse, setBookingForSomeoneElse] = useState(false);
  const [touched, setTouched] = useState({ firstName: false, lastName: false, phone: false });
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00 AM");
  const [nextQueuePosition, setNextQueuePosition] = useState<number | null>(null);
  const [myQueuePosition, setMyQueuePosition] = useState<number | null>(null);
  const [booking, setBooking] = useState(false);
  const [verifyingCaptcha, setVerifyingCaptcha] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileCaptchaHandle | null>(null);
  const firstNameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    supabase
      .from("services")
      .select("*")
      .eq("salon_id", salon.id)
      .then(({ data }) => setServices(data || []));
  }, [salon.id]);

  useEffect(() => {
    const loadBarbers = async () => {
      const { data } = await supabase
        .from("barbers" as any)
        .select("id, name, chair_number, specialization")
        .eq("salon_id", salon.id)
        .order("name");

      const nextBarbers = (data || []) as BarberRow[];
      setBarbers(nextBarbers);
      setSelectedBarberId((current) => current || nextBarbers[0]?.id || "");
    };

    loadBarbers();
  }, [salon.id]);

  useEffect(() => {
    firstNameInputRef.current?.focus();
  }, [bookingForSomeoneElse]);

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
      const { data } = await supabase
        .from("queue" as any)
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

    setVerifyingCaptcha(true);

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

    const { data: conflictCheck } = await supabase
      .from("queue" as any)
      .select("id")
      .eq("salon_id", salon.id)
      .eq("barber_id", selectedBarberId)
      .eq("booking_date", date)
      .eq("booking_time", time)
      .in("status", ["waiting", "in_progress"])
      .limit(1)
      .maybeSingle();

    if (conflictCheck) {
      setBooking(false);
      toast.error(`Barber is already booked for ${time} on ${date}. Please choose another slot or barber.`);
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

    const { error } = await supabase.from("queue" as any).insert({
      user_id: null,
      salon_id: salon.id,
      service_id: selectedService.id,
      barber_id: selectedBarberId,
      status: "waiting",
      position: nextPosition,
      created_at: createdAt,
      customer_first_name: activeCustomer.firstName.trim(),
      customer_last_name: activeCustomer.lastName.trim(),
      customer_phone: activeCustomer.phone.trim(),
      notes: customer.notes.trim() || null,
      booking_date: date,
      booking_time: time,
    } as any);

    if (error) {
      setBooking(false);
      toast.error(error.message);
    } else {
      if (bookingForSomeoneElse) {
        setCustomer((prev) => ({ ...prev, firstName: "", lastName: "", phone: "" }));
      }

      setMyQueuePosition(nextPosition);
      const successMsg = isAdvanceBooking
        ? `Booking confirmed for ${date} at ${time}. Your position: #${nextPosition}`
        : `Booking successful. Your position in queue: #${nextPosition}`;
      toast.success(successMsg);
      onJoined();
      setBooking(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="min-h-screen bg-[#f7f3ff]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 overflow-hidden rounded-xl bg-white shadow-sm">
          <div className="relative h-56 bg-muted md:h-72">
            <img src={salonImages[salon.image_url ?? ""] ?? salon1} alt={salon.name} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
            <button
              onClick={onBack}
              className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur-sm transition-transform hover:scale-105 sm:left-6 sm:top-6"
            >
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </button>
            <div className="absolute bottom-0 left-0 right-0 p-4 text-white sm:p-6 lg:p-8">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
                <MapPin className="h-3.5 w-3.5" /> {salon.location}
              </div>
              <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl md:text-4xl lg:text-4xl">{salon.name}</h1>
              <p className="mt-2 flex flex-wrap items-center gap-3 text-sm text-white/90">
                <span className="inline-flex items-center gap-1.5"><Navigation className="h-4 w-4" /> {travelMin} min away</span>
                <span className="inline-flex items-center gap-1.5"><Star className="h-4 w-4 fill-current" /> Premium booking experience</span>
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <section className="rounded-xl bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 rounded-2xl bg-[#faf9fc] p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-semibold text-foreground">Profile</h3>
                    <span className="rounded-full bg-purple-50 px-2.5 py-1 text-[11px] font-semibold text-purple-700">
                      {hasSavedProfile ? "Saved" : "One-time setup"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">Create it once and reuse it for every booking.</p>

                  {hasSavedProfile ? (
                    <div className="mt-2 space-y-1 text-sm text-gray-700">
                      <p className="font-medium text-gray-900">{savedProfile.firstName} {savedProfile.lastName}</p>
                      <p>{savedProfile.phone}</p>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-gray-700">Enter your name and phone one time to unlock faster booking.</p>
                  )}
                </div>

                <div className="flex flex-col gap-3 sm:items-end">
                  {hasSavedProfile ? (
                    <button
                      type="button"
                      onClick={() => {
                        setProfileDraft(savedProfile);
                        setProfileModalOpen(true);
                      }}
                      className="text-sm font-medium text-purple-700 transition hover:text-purple-800"
                    >
                      Edit profile
                    </button>
                  ) : null}

                  <div className="flex items-center gap-2 rounded-full bg-white px-3 py-2 shadow-sm">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={bookingForSomeoneElse}
                      onClick={() => {
                        const next = !bookingForSomeoneElse;
                        setBookingForSomeoneElse(next);
                        setTouched({ firstName: false, lastName: false, phone: false });

                        if (next) {
                          setCustomer((prev) => ({ ...prev, firstName: "", lastName: "", phone: "" }));
                        } else if (hasSavedProfile) {
                          setCustomer((prev) => ({ ...prev, ...savedProfile }));
                        }
                      }}
                      className={`relative h-6 w-11 rounded-full transition ${bookingForSomeoneElse ? "bg-purple-600" : "bg-gray-300"}`}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition ${bookingForSomeoneElse ? "left-5" : "left-0.5"}`}
                      />
                    </button>
                    <p className="text-sm text-gray-600">Booking for someone else?</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-500">First Name</label>
                    <Input
                      ref={firstNameInputRef}
                      value={activeCustomer.firstName}
                      onChange={(event) => setCustomer((prev) => ({ ...prev, firstName: event.target.value }))}
                      onBlur={() => setTouched((prev) => ({ ...prev, firstName: true }))}
                      placeholder="Enter first name"
                      readOnly={!bookingForSomeoneElse && hasSavedProfile}
                      className="rounded-lg border border-gray-100 px-4 py-3 transition focus:ring-2 focus:ring-purple-500"
                    />
                    {firstNameError ? <p className="mt-1 text-sm text-red-600">{firstNameError}</p> : null}
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-500">Last Name</label>
                    <Input
                      value={activeCustomer.lastName}
                      onChange={(event) => setCustomer((prev) => ({ ...prev, lastName: event.target.value }))}
                      onBlur={() => setTouched((prev) => ({ ...prev, lastName: true }))}
                      placeholder="Enter last name"
                      readOnly={!bookingForSomeoneElse && hasSavedProfile}
                      className="rounded-lg border border-gray-100 px-4 py-3 transition focus:ring-2 focus:ring-purple-500"
                    />
                    {lastNameError ? <p className="mt-1 text-sm text-red-600">{lastNameError}</p> : null}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-500">Phone Number</label>
                  <Input
                    value={activeCustomer.phone}
                    onChange={(event) => setCustomer((prev) => ({ ...prev, phone: event.target.value }))}
                    onBlur={() => setTouched((prev) => ({ ...prev, phone: true }))}
                    placeholder="Enter phone number"
                    inputMode="tel"
                    readOnly={!bookingForSomeoneElse && hasSavedProfile}
                    className="rounded-lg border border-gray-100 px-4 py-3 transition focus:ring-2 focus:ring-purple-500"
                  />
                  {phoneError ? <p className="mt-1 text-sm text-red-600">{phoneError}</p> : null}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-500">Notes (optional)</label>
                  <textarea
                    value={customer.notes}
                    onChange={(event) => setCustomer((prev) => ({ ...prev, notes: event.target.value }))}
                    placeholder="Add special requests or notes"
                    rows={3}
                    className="w-full rounded-lg border border-gray-100 px-4 py-3 text-sm outline-none transition placeholder:text-gray-400 focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
            </section>

            <section className="rounded-xl bg-white p-6 shadow-sm">
              <h3 className="text-xl font-semibold text-foreground">Select Service</h3>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {services.map((svc) => (
                  <button
                    key={svc.id}
                    onClick={() => setSelectedService(svc)}
                    className={`rounded-xl border p-4 text-left transition-all duration-200 hover:shadow-md ${
                      selectedService?.id === svc.id
                        ? "border-purple-500 bg-purple-50 shadow-sm"
                        : "border-gray-100 bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-foreground">{svc.name}</p>
                        <p className="mt-1 text-sm text-gray-500">Premium service</p>
                      </div>
                      {selectedService?.id === svc.id ? <Check className="h-5 w-5 text-purple-600" /> : null}
                    </div>
                    <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
                      <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4" /> {svc.duration}m</span>
                      <span className="inline-flex items-center gap-1.5"><DollarSign className="h-4 w-4" /> INR {svc.price}</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-xl bg-white p-6 shadow-sm">
              <h3 className="text-xl font-semibold text-foreground">Choose Barber</h3>
              {barbers.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-gray-200 p-5 text-sm text-gray-500">No barbers available right now.</div>
              ) : (
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {barbers.map((barber, index) => {
                    const selected = selectedBarberId === barber.id;

                    return (
                      <button
                        key={barber.id}
                        onClick={() => setSelectedBarberId(barber.id)}
                        className={`rounded-xl border p-4 text-left transition-all duration-200 hover:shadow-md ${
                          selected ? "border-purple-500 bg-purple-50 shadow-sm" : "border-gray-100 bg-white"
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`flex h-12 w-12 items-center justify-center rounded-full ${selected ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-600"}`}>
                            <UserRound className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-3">
                              <p className="truncate font-semibold text-foreground">{barber.name}</p>
                              {selected ? <Check className="h-5 w-5 text-purple-600" /> : null}
                            </div>
                            <p className="mt-1 text-sm text-gray-500">Chair {barber.chair_number ?? index + 1}</p>
                            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-gray-700">
                                <Star className="h-3.5 w-3.5 text-amber-500" /> 4.9
                              </span>
                              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">Available</span>
                              <span className="rounded-full bg-purple-50 px-2.5 py-1 text-purple-700">{barber.specialization || "General"}</span>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="rounded-xl bg-white p-6 shadow-sm">
              <h3 className="text-xl font-semibold text-foreground">Select Time</h3>
              <p className="mt-2 text-sm text-gray-500">Advance bookings: up to 30 days ahead (30-minute slots)</p>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-500">Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      type="date"
                      required
                      min={getMinDate()}
                      max={getMaxDate()}
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="border-gray-100 pl-10"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-500">Time (30-min slots)</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <select
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="h-10 w-full rounded-lg border border-gray-100 bg-white pl-10 pr-3 text-sm outline-none transition focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Select time slot</option>
                      {TIME_SLOTS.map((slot) => (
                        <option key={slot} value={slot}>{slot}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <aside className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 p-6 text-white shadow-lg lg:sticky lg:top-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-widest text-white/70">Booking Summary</p>
                  <h3 className="mt-2 text-2xl font-bold">Ready to join</h3>
                </div>
                <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white">
                  {bookingTypeLabel}
                </span>
              </div>

              <div className="mt-6 space-y-3">
                <div className="rounded-lg bg-white/10 p-3 backdrop-blur-sm">
                  <p className="text-sm text-white/70">Customer</p>
                  <p className="mt-1 font-semibold">{customerName || "Enter name"}</p>
                  <p className="text-sm text-white/75">{activeCustomer.phone || "Enter phone"}</p>
                </div>

                <div className="rounded-lg bg-white/10 p-3 backdrop-blur-sm">
                  <p className="text-sm text-white/70">Service</p>
                  <p className="mt-1 font-semibold">{selectedService?.name || "Choose service"}</p>
                  <p className="text-sm text-white/75">{selectedService ? `INR ${selectedService.price} • ${selectedService.duration}m` : "Select service"}</p>
                </div>

                <div className="rounded-lg bg-white/10 p-3 backdrop-blur-sm">
                  <p className="text-sm text-white/70">Barber</p>
                  <p className="mt-1 font-semibold">{selectedBarber?.name || "Select barber"}</p>
                  <p className="text-sm text-white/75">{selectedBarber ? `Chair ${selectedBarber.chair_number ?? 1}` : "Choose barber"}</p>
                </div>

                <div className="rounded-lg bg-white/10 p-3 backdrop-blur-sm">
                  <p className="text-sm text-white/70">Wait time</p>
                  <p className="mt-1 font-semibold">{estimatedWait}</p>
                </div>

                <div className="rounded-lg bg-white/10 p-3 backdrop-blur-sm">
                  <p className="text-sm text-white/70">Queue position</p>
                  <p className="mt-1 font-semibold">{myQueuePosition ? `Your position in queue: #${myQueuePosition}` : `If you join now: #${nextQueuePosition ?? "--"}`}</p>
                </div>

                <div className="rounded-lg bg-white/10 p-3 backdrop-blur-sm">
                  <p className="text-sm text-white/70">Price</p>
                  <p className="mt-1 text-2xl font-bold">INR {selectedService?.price || 0}</p>
                </div>

                <div className="rounded-lg bg-white/10 p-3 backdrop-blur-sm">
                  <p className="text-sm text-white/70">Verification</p>
                  <div className="mt-2 min-h-[78px] rounded-md bg-white/10 p-2">
                    <TurnstileCaptcha ref={turnstileRef} onTokenChange={setCaptchaToken} className="min-h-[78px]" />
                  </div>
                </div>
              </div>

              <button
                onClick={handleBook}
                disabled={!date || !selectedService || booking || verifyingCaptcha || !captchaToken}
                className="mt-6 w-full rounded-lg bg-orange-500 py-3 font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
              >
                {booking ? <Loader2 className="inline mr-2 h-5 w-5 animate-spin" /> : "Join Queue"}
              </button>
            </motion.div>
          </aside>
        </div>
      </div>

      {profileModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-xl font-semibold text-foreground">Create your profile</h3>
            <p className="mt-1 text-sm text-gray-500">Save your details once for faster booking next time.</p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-500">First Name</label>
                <Input
                  value={profileDraft.firstName}
                  onChange={(e) => setProfileDraft((prev) => ({ ...prev, firstName: e.target.value }))}
                  placeholder="Enter first name"
                  className="border-gray-100"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-500">Last Name</label>
                <Input
                  value={profileDraft.lastName}
                  onChange={(e) => setProfileDraft((prev) => ({ ...prev, lastName: e.target.value }))}
                  placeholder="Enter last name"
                  className="border-gray-100"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-500">Phone</label>
                <Input
                  value={profileDraft.phone}
                  onChange={(e) => setProfileDraft((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="Enter phone number"
                  inputMode="tel"
                  className="border-gray-100"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={saveProfile}
                className="rounded-lg bg-orange-500 px-4 py-2 font-semibold text-white transition hover:bg-orange-600"
              >
                Save and continue
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </motion.div>
  );
}

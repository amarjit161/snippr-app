import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import { Loader2, Clock3, MapPin, Scissors, CalendarDays, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import gsap from "gsap";
import { CancelConfirmation } from "@/components/CancelConfirmation";
import { CancelPopup, CompletionCelebration } from "@/components/CancelConfirmationPage";
import { RescheduleModal } from "@/components/RescheduleModal";
import { sendBookingEmail } from "@/services/emailService";

type BookingTab = "upcoming" | "past" | "cancelled";
const RESCHEDULE_LOCKED_STATUSES = new Set(["accepted", "confirmed", "in_progress", "done", "completed"]);

const normalizeStatus = (status?: string) => {
  const normalized = String(status || "").trim().toLowerCase().replace(/\s+/g, "_");
  if (normalized === "canceled") return "cancelled";
  return normalized;
};

const isRescheduleLocked = (status?: string) => RESCHEDULE_LOCKED_STATUSES.has(normalizeStatus(status));

// OTP is active for: waiting, confirmed, accepted, in_progress
// OTP expires (becomes invalid) for: completed, done, cancelled, rejected
const isOTPActive = (status?: string): boolean => {
  const normalized = normalizeStatus(status);
  const activeStatuses = new Set(["waiting", "confirmed", "accepted", "in_progress"]);
  return activeStatuses.has(normalized);
};

const toDateLabel = (date?: string) => {
  if (!date) return "Date TBD";
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-IN", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
};

const formatTimeSlot = (timeSlot?: string) => {
  if (!timeSlot) return "Time not set";
  const [h, m] = timeSlot.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return timeSlot;
  const period = h >= 12 ? "PM" : "AM";
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
};

const formatPrice = (amount: number) => `₹${amount.toLocaleString("en-IN")}`;

const BOOKING_SELECT = `
  id,
  salon_id,
  user_id,
  service_id,
  barber_id,
  position,
  status,
  created_at,
  started_at,
  completed_at,
  booking_date,
  customer_first_name,
  customer_last_name,
  customer_phone,
  email,
  time_slot,
  notes,
  services (id, name, price, duration),
  salons (id, name, owner_id, address, location, city, image_url)
`;

const isPastDate = (date?: string) => {
  if (!date) return false;
  const today = new Date();
  const nowDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return date < nowDate;
};

type BookingCardProps = {
  booking: any;
  onCancel: (id: string) => void;
  onManage: (booking: any) => void;
  showActions: boolean;
  updatingId: string | null;
};

const BookingCard = ({ booking: b, onCancel, onManage, showActions, updatingId }: BookingCardProps) => {
  const cardRef = useRef<HTMLElement | null>(null);
  const isTouchPointer = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

  // Debug logging
  console.log("📍 BookingCard rendered:", {
    id: b.id,
    status: b.status,
    arrival_otp: b.arrival_otp,
    hasOTP: !!b.arrival_otp,
  });

  const handleMove = (event: React.MouseEvent<HTMLElement>) => {
    if (isTouchPointer) return;
    if (!cardRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;

    gsap.to(cardRef.current, {
      rotateY: x * 5,
      rotateX: y * -5,
      x: x * 4,
      y: y * 3,
      scale: 1.006,
      duration: 0.22,
      ease: "power2.out",
      transformPerspective: 1200,
      transformOrigin: "center center",
    });
  };

  const resetCard = () => {
    if (!cardRef.current) return;

    gsap.to(cardRef.current, {
      rotateY: 0,
      rotateX: 0,
      x: 0,
      y: 0,
      scale: 1,
      duration: 0.28,
      ease: "power3.out",
      clearProps: "transform",
    });
  };

  const salonName = b.salons?.name || "Salon";
  const serviceName = b.services?.name || "Service";
  const price = b.services?.price || 0;
  const salonImage = b.salons?.image_url || "/default-salon.jpg";
  const status = normalizeStatus(b.status || "pending");
  const rescheduleLocked = isRescheduleLocked(status);

  return (
    <article
      ref={cardRef}
      data-booking-card
      className="overflow-hidden rounded-3xl border border-[#e5e2ea] bg-white shadow-sm will-change-transform"
      onMouseMove={handleMove}
      onMouseEnter={() => {
        if (isTouchPointer) return;
        if (!cardRef.current) return;
        gsap.to(cardRef.current, { boxShadow: "0 18px 42px rgba(79,55,138,0.12)", duration: 0.18 });
      }}
      onMouseLeave={() => {
        resetCard();
        if (!cardRef.current) return;
        gsap.to(cardRef.current, { boxShadow: "0 10px 20px rgba(15,23,42,0.05)", duration: 0.2 });
      }}
    >
      <div className="grid gap-0 md:grid-cols-[190px_1fr]">
        <div className="h-52 w-full overflow-hidden md:h-full">
          <img src={salonImage} alt={salonName} className="h-full w-full object-cover" />
        </div>

        <div className="p-6 sm:p-7">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-4xl font-extrabold tracking-tight text-[#111525]">{salonName}</h2>
              <p className="mt-1 text-lg text-[#6b6474]">
                📍 {[b.salons?.city, b.salons?.address || b.salons?.location].filter(Boolean).join(", ") || "Address unavailable"}
              </p>
            </div>
            <span className="rounded-full bg-[#7a43e9] px-3 py-1 text-sm font-bold text-white">
              {status === "accepted" || status === "confirmed" ? "Confirmed" : status}
            </span>
          </div>

          <div className="grid gap-4 border-y border-[#ece9f0] py-5 sm:grid-cols-2">
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-xl font-semibold text-[#171a27]">
                <Scissors className="h-5 w-5 text-[#7a43e9]" /> {serviceName}
              </p>
              <p className="flex items-center gap-2 text-xl text-[#3d3f49]">
                <Clock3 className="h-5 w-5 text-[#7a43e9]" /> {formatTimeSlot(b.time_slot)}
              </p>
            </div>

            <div className="space-y-3">
              <p className="flex items-center gap-2 text-xl text-[#3d3f49]">
                <CalendarDays className="h-5 w-5 text-[#7a43e9]" /> {toDateLabel(b.booking_date)}
              </p>
              <p className="flex items-center gap-2 text-xl text-[#3d3f49]">
                <MapPin className="h-5 w-5 text-[#7a43e9]" /> {b.salons?.city || "Location unavailable"}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-4xl font-extrabold text-[#7a43e9]">{formatPrice(price)}</p>

            {/* OTP Display for active bookings - Valid until completed/cancelled */}
            {isOTPActive(status) && b.arrival_otp && (
              <div className="w-full">
                <div className="pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2">
                    Arrival Code (Show at Salon)
                  </p>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex gap-1.5">
                      {b.arrival_otp.split('').map((digit: string, i: number) => (
                        <div key={i} 
                             className="w-9 h-10 bg-purple-50 border-2 border-purple-200 rounded-lg 
                                        flex items-center justify-center text-lg font-black text-purple-700">
                          {digit}
                        </div>
                      ))}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Valid until done</p>
                      <p className="text-xs text-green-600 font-medium mt-0.5">● Active</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {showActions ? (
              <div className="flex gap-3 w-full">
                <Button
                  variant="outline"
                  className="flex-1 h-11 rounded-full border-rose-300 px-6 text-rose-600 hover:bg-rose-50"
                  disabled={updatingId === b.id}
                  onClick={() => onCancel(b.id)}
                >
                  {updatingId === b.id ? "Cancelling..." : "Cancel"}
                </Button>
                <Button
                  className="flex-1 h-11 rounded-full px-6"
                  disabled={updatingId === b.id || rescheduleLocked}
                  onClick={() => onManage(b)}
                >
                  {rescheduleLocked ? "Locked" : "Manage"}
                </Button>
              </div>
            ) : null}
          </div>
          {showActions && rescheduleLocked && (
            <p className="mt-2 text-xs text-amber-700">Reschedule is disabled after barber accepts the booking.</p>
          )}
        </div>
      </div>
    </article>
  );
};

export default function Dashboard() {
  const { user, signOut, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [bookings, setBookings] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);
  const [activeTab, setActiveTab] = useState<BookingTab>("upcoming");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [cancelPendingId, setCancelPendingId] = useState<string | null>(null);
  const [showCancelPopup, setShowCancelPopup] = useState(false);
  const [cancelledBooking, setCancelledBooking] = useState<any>(null);
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<any>(null);
  const [showCompletionCelebration, setShowCompletionCelebration] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<number | null>(null);
  
  // Cache validity: 60 seconds
  const CACHE_VALIDITY_MS = 60000;

  useEffect(() => {
    if (!user) {
      console.log("🚪 USER_LOGGED_OUT: Redirecting to home");
      navigate("/", { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    const fromLanding = (location.state as { transitionFrom?: string } | null)?.transitionFrom === "landing";

    const ctx = gsap.context(() => {
      const base = "[data-bookings-shell]";
      gsap.fromTo(
        base,
        fromLanding
          ? { opacity: 0, y: 10, scale: 0.992 }
          : { opacity: 0, y: 10, scale: 0.992 },
        {
          opacity: 1,
          x: 0,
          y: 0,
          scale: 1,
          duration: fromLanding ? 0.22 : 0.18,
          ease: "power2.out",
          clearProps: "transform",
        }
      );

      gsap.fromTo(
        "[data-bookings-shell] > *",
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.18, stagger: 0.02, ease: "power2.out", delay: 0.02 }
      );
    });

    return () => ctx.revert();
  }, [location.state]);

  useEffect(() => {
    if (fetching || bookings.length === 0) return;

    const cards = gsap.utils.toArray<HTMLElement>("[data-booking-card]");
    if (cards.length === 0) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(cards, { opacity: 0, y: 12, scale: 0.992 }, { opacity: 1, y: 0, scale: 1, duration: 0.26, stagger: 0.05, ease: "power2.out", delay: 0.04 });
    });

    return () => ctx.revert();
  }, [fetching, bookings.length, activeTab]);

  const fetchBookings = async (skipCache = false) => {
    // Check cache validity
    if (!skipCache && lastFetchTime && Date.now() - lastFetchTime < CACHE_VALIDITY_MS) {
      console.log("📦 BOOKINGS: Using cached data (fresh)");
      setFetching(false);
      return;
    }

    // Only show loading for initial fetch or forced refresh
    if (bookings.length === 0) {
      setFetching(true);
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log("BOOKINGS: No authenticated user");
      setBookings([]);
      setFetching(false);
      return;
    }

        const { data, error } = await supabase
      .from("customer_bookings")
      .select(BOOKING_SELECT)
      .eq("user_id", user.id)
      .order("booking_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("BOOKINGS_FETCH_ERROR:", error);
      if (bookings.length === 0) {
        setBookings([]);
      }
    } else {
      setBookings(data || []);
      setLastFetchTime(Date.now());
      console.log("✅ BOOKINGS: Fetched", data?.length || 0, "bookings from database");
      // Debug: Log arrival_otp for each booking
      data?.forEach((booking: any, idx: number) => {
        console.log(`📌 Booking ${idx + 1}:`, {
          id: booking.id,
          status: booking.status,
          arrival_otp: booking.arrival_otp,
          booking_date: booking.booking_date,
        });
      });
    }
    setFetching(false);
  };

  const today = new Date().toISOString().split("T")[0];
  const upcomingBookings = useMemo(
    () =>
      bookings.filter(
        (b) =>
          String(b.booking_date || "") >= today &&
          ["waiting", "confirmed", "in_progress"].includes(normalizeStatus(b.status))
      ),
    [bookings, today]
  );

  const pastBookings = useMemo(
    () =>
      bookings.filter(
        (b) =>
          String(b.booking_date || "") < today ||
          ["completed", "done"].includes(normalizeStatus(b.status))
      ),
    [bookings, today]
  );

  const cancelledBookings = useMemo(
    () => bookings.filter((b) => ["cancelled", "rejected"].includes(normalizeStatus(b.status))),
    [bookings]
  );

  const filteredBookings = useMemo(() => {
    if (activeTab === "upcoming") return upcomingBookings;
    if (activeTab === "past") return pastBookings;
    return cancelledBookings;
  }, [activeTab, upcomingBookings, pastBookings, cancelledBookings]);

  const handleCancelClick = (id: string) => {
    setCancelPendingId(id);
  };

  const handleCancelConfirm = async () => {
    if (!cancelPendingId || !user?.id) {
      toast.error("Unable to cancel booking.");
      return;
    }

    console.log("CANCEL_BOOKING_START", {
      bookingId: cancelPendingId,
      userId: user.id,
    });

    setUpdatingId(cancelPendingId);
    try {
      // Get booking details before cancelling
      const booking = bookings.find((b) => b.id === cancelPendingId);
      if (!booking) {
        console.warn("CANCEL_BOOKING_NOT_FOUND", { bookingId: cancelPendingId });
        toast.error("Booking not found.");
        setCancelPendingId(null);
        return;
      }

      // Update booking status to cancelled
      const { data: updatedBooking, error } = await supabase
        .from("queue")
        .update({ status: "cancelled" } as any)
        .eq("id", cancelPendingId)
        .eq("user_id", user.id)
        .select("id, status")
        .maybeSingle();

      if (error) {
        console.error("CANCEL_BOOKING_ERROR", error);
        toast.error("Unable to cancel booking right now.");
        setCancelPendingId(null);
        return;
      }

      if (!updatedBooking) {
        console.warn("CANCEL_BOOKING_NO_ROW_UPDATED", {
          bookingId: cancelPendingId,
          userId: user.id,
        });
        toast.error("Unable to cancel this booking right now. Please refresh and try again.");
        setCancelPendingId(null);
        return;
      }

      console.log("CANCEL_BOOKING_DB_UPDATED", {
        bookingId: cancelPendingId,
        nextStatus: updatedBooking.status,
      });

      if (user?.email) {
        try {
          // Get owner email
          const { data: ownerData } = await supabase
            .from("owners")
            .select("email")
            .eq("id", booking.salons?.owner_id)
            .maybeSingle();

          const [h, m] = (booking.time_slot || "").split(":").map(Number);
          const period = h >= 12 ? "PM" : "AM";
          const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
          const displayTime = `${hour}:${String(m).padStart(2, "0")} ${period}`;

          await sendBookingEmail('booking_cancelled', {
            bookingId: booking.id,
            salonId: booking.salon_id,
            salonName: booking.salons?.name || "Salon",
            salonAddress: booking.salons?.address || booking.salons?.location || '',
            customerName: `${booking.customer_first_name || ''} ${booking.customer_last_name || ''}`.trim() || 'Customer',
            customerEmail: user.email,
            customerPhone: booking.customer_phone,
            ownerEmail: ownerData?.email || '',
            serviceName: booking.services?.name || "Service",
            barberName: '',
            bookingDate: booking.booking_date,
            timeSlot: displayTime,
            amount: booking.services?.price || 0,
          });

          console.log("CANCEL_BOOKING_EMAIL_SENT", {
            bookingId: booking.id,
            userEmail: user.email,
          });
        } catch (emailErr) {
          console.warn("❌ CANCEL_EMAIL_FAILED", emailErr);
        }
      }

      // Immediately update local state to remove from upcoming
      setBookings((prev) =>
        prev.map((b) =>
          b.id === cancelPendingId ? { ...b, status: "cancelled" } : b
        )
      );

      // Show cancel popup with sad animation
      setCancelledBooking({
        id: booking.id,
        salon_name: booking.salons?.name || "Salon",
        service_name: booking.services?.name || "Service",
        current_date: booking.booking_date,
        current_time: booking.time_slot,
        previous_status: normalizeStatus(booking.status),
      });
      setShowCancelPopup(true);
      setCancelPendingId(null);
      console.log("CANCEL_BOOKING_SUCCESS", { bookingId: booking.id });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRescheduleFromCancel = () => {
    setShowCancelPopup(false);
    if (cancelledBooking?.id) {
      if (isRescheduleLocked(cancelledBooking.previous_status)) {
        toast.error("Reschedule is not allowed after barber acceptance.");
        setCancelledBooking(null);
        return;
      }
      const target = bookings.find((b) => b.id === cancelledBooking.id);
      setRescheduleTarget(target || cancelledBooking);
      setRescheduleModalOpen(true);
    }
  };

  const handleManageClick = (booking: any) => {
    if (isRescheduleLocked(booking?.status)) {
      toast.error("Reschedule is not allowed after barber acceptance.");
      return;
    }
    setRescheduleTarget(booking);
    setRescheduleModalOpen(true);
  };

  const handleRescheduleConfirm = async (newDate: string, newTime: string) => {
    if (!rescheduleTarget || !user?.id) {
      toast.error("Unable to reschedule.");
      return;
    }

    if (isRescheduleLocked(rescheduleTarget.status)) {
      toast.error("Reschedule is not allowed after barber acceptance.");
      return;
    }

    setUpdatingId(rescheduleTarget.id);
    try {
      const { data, error } = await supabase
        .from("queue")
        .update({
          booking_date: newDate,
          time_slot: newTime,
        } as any)
        .eq("id", rescheduleTarget.id)
        .eq("user_id", user.id)
        .not("status", "in", '("accepted","confirmed","in_progress","done","completed")')
        .select("id")
        .maybeSingle();

      if (error) {
        console.error("RESCHEDULE_ERROR", error);
        toast.error("Unable to reschedule booking.");
        return;
      }

      if (!data) {
        toast.error("Reschedule blocked. This booking is already accepted by barber.");
        return;
      }

      // Send reschedule email
      if (user?.email && rescheduleTarget) {
        try {
          const { data: ownerData } = await supabase
            .from("owners")
            .select("email")
            .eq("id", rescheduleTarget.salons?.owner_id)
            .maybeSingle();

          const [oldH, oldM] = (rescheduleTarget.time_slot || "").split(":").map(Number);
          const oldPeriod = oldH >= 12 ? "PM" : "AM";
          const oldHour = oldH > 12 ? oldH - 12 : oldH === 0 ? 12 : oldH;
          const oldDisplayTime = `${oldHour}:${String(oldM).padStart(2, "0")} ${oldPeriod}`;

          const [h, m] = (newTime || "").split(":").map(Number);
          const period = h >= 12 ? "PM" : "AM";
          const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
          const displayTime = `${hour}:${String(m).padStart(2, "0")} ${period}`;

          await sendBookingEmail('booking_rescheduled', {
            bookingId: rescheduleTarget.id,
            salonId: rescheduleTarget.salon_id,
            salonName: rescheduleTarget.salons?.name || "Salon",
            salonAddress: rescheduleTarget.salons?.address || rescheduleTarget.salons?.location || '',
            customerName: `${rescheduleTarget.customer_first_name || ''} ${rescheduleTarget.customer_last_name || ''}`.trim() || 'Customer',
            customerEmail: user.email,
            customerPhone: rescheduleTarget.customer_phone,
            ownerEmail: ownerData?.email || '',
            serviceName: rescheduleTarget.services?.name || "Service",
            barberName: '',
            bookingDate: newDate,
            timeSlot: displayTime,
            amount: rescheduleTarget.services?.price || 0,
            oldDate: rescheduleTarget.booking_date,
            oldTime: oldDisplayTime,
          });

          console.log("RESCHEDULE_EMAIL_SENT", { bookingId: rescheduleTarget.id });
        } catch (emailErr) {
          console.warn("❌ RESCHEDULE_EMAIL_FAILED", emailErr);
        }
      }

      // Update local state
      setBookings((prev) =>
        prev.map((b) =>
          b.id === rescheduleTarget.id
            ? { ...b, booking_date: newDate, time_slot: newTime }
            : b
        )
      );

      toast.success("Booking rescheduled successfully!");
      setRescheduleModalOpen(false);
      setRescheduleTarget(null);
    } finally {
      setUpdatingId(null);
    }
  };

  useEffect(() => {
    let queueChannel: ReturnType<typeof supabase.channel> | null = null;

    const setupQueueSync = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      if (queueChannel) {
        supabase.removeChannel(queueChannel);
      }

      queueChannel = supabase
        .channel(`user-queue-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "queue",
            filter: `user_id=eq.${user.id}`,
          },
          fetchBookings
        )
        .subscribe();
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        fetchBookings();
        setupQueueSync();
      }

      if (event === "SIGNED_OUT") {
        setBookings([]);
        setFetching(false);
      }
    });

    fetchBookings();
    setupQueueSync();

    return () => {
      subscription.unsubscribe();
      if (queueChannel) {
        supabase.removeChannel(queueChannel);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#f4f3f6]">
      <Header
        onSignOut={signOut}
        userName={profile?.name || user?.email || "Customer"}
        userEmail={user?.email || undefined}
        profileName={profile?.name || undefined}
        onAdminToggle={profile ? () => navigate("/owner-dashboard") : undefined}
      />

      {/* Cancellation Confirmation Modal */}
      {cancelPendingId && (
        <CancelConfirmation
          open={!!cancelPendingId}
          onClose={() => setCancelPendingId(null)}
          onConfirm={handleCancelConfirm}
          isLoading={updatingId === cancelPendingId}
          salonName={bookings.find((b) => b.id === cancelPendingId)?.salons?.name || "Salon"}
          serviceName={bookings.find((b) => b.id === cancelPendingId)?.services?.name || "Service"}
        />
      )}

      {/* Confirmation Page with Barber Animation */}
      {showCancelPopup && cancelledBooking && (
        <CancelPopup
          booking={cancelledBooking}
          canReschedule={!isRescheduleLocked(cancelledBooking.previous_status)}
          onReschedule={handleRescheduleFromCancel}
          onClose={() => {
            setShowCancelPopup(false);
            setCancelledBooking(null);
            toast.success("Booking cancelled successfully.");
          }}
        />
      )}

      {/* Reschedule Modal */}
      <RescheduleModal
        open={rescheduleModalOpen}
        onClose={() => {
          setRescheduleModalOpen(false);
          setRescheduleTarget(null);
        }}
        onConfirm={handleRescheduleConfirm}
        booking={rescheduleTarget}
        isLoading={rescheduleTarget && updatingId === rescheduleTarget.id}
      />

      <div data-bookings-shell className="mx-auto max-w-5xl px-4 pb-12 pt-10 sm:px-6">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center gap-2 text-gray-600 transition-colors hover:text-gray-900"
        >
          <ChevronLeft className="h-5 w-5" />
          <span className="text-sm font-medium">Back</span>
        </button>

        <div className="mb-8">
          <h1 className="font-display text-5xl font-extrabold tracking-tight text-[#121521]">My Bookings</h1>
          <div className="mt-6 flex gap-6 border-b border-[#dfdce4] text-xl font-bold uppercase tracking-[0.08em]">
            {[
              { key: "upcoming", label: "Upcoming" },
              { key: "past", label: "Past" },
              { key: "cancelled", label: "Cancelled" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as BookingTab)}
                className={`pb-3 transition ${
                  activeTab === tab.key
                    ? "border-b-4 border-primary text-primary"
                    : "text-[#6b6474] hover:text-[#373245]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {fetching ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-[#7a43e9]" />
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#d8d4df] bg-white p-12 text-center text-[#6b6474]">
            No bookings in this section.
          </div>
        ) : (
          <div className="space-y-5">
            {filteredBookings.map((b) => {
              return (
                <BookingCard
                  key={b.id}
                  booking={b}
                  onCancel={handleCancelClick}
                  onManage={() => handleManageClick(b)}
                  showActions={activeTab === "upcoming"}
                  updatingId={updatingId}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


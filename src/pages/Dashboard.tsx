import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import { Loader2, Clock3, MapPin, Scissors, CalendarDays, ChevronLeft, Star } from "lucide-react";
import { toast } from "sonner";
import gsap from "gsap";
import { CancelConfirmation } from "@/components/CancelConfirmation";
import { CancelPopup, CompletionCelebration } from "@/components/CancelConfirmationPage";
import { RescheduleModal } from "@/components/RescheduleModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { sendBookingEmail } from "@/services/emailService";
import { generateOTP } from "@/lib/otpUtils";

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
  const activeStatuses = new Set(["pending", "waiting", "confirmed", "accepted", "in_progress"]);
  return activeStatuses.has(normalized);
};

// A booking can be reviewed once the salon has marked it done/completed.
const isReviewableStatus = (status?: string): boolean => {
  const normalized = normalizeStatus(status);
  return normalized === "done" || normalized === "completed";
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
  customer_id,
  service_id,
  stylist_id,
  position,
  status,
  created_at,
  booking_date,
  booking_time,
  otp,
  queue_position,
  notes,
  customer_profiles (first_name, last_name, phone, email),
  services (id, name, price, duration),
  salons (id, name, owner_id, address, location, city, image_url),
  barbers (id, name)
`;

const isPastDate = (date?: string) => {
  if (!date) return false;
  const today = new Date();
  const nowDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return date < nowDate;
};

type ReviewInfo = { id: string; rating: number; comment: string | null };

type BookingCardProps = {
  booking: any;
  onCancel: (id: string) => void;
  onManage: (booking: any) => void;
  showActions: boolean;
  updatingId: string | null;
  existingReview?: ReviewInfo | null;
  onLeaveReview?: (booking: any) => void;
};

const BookingCard = ({ booking: b, onCancel, onManage, showActions, updatingId, existingReview, onLeaveReview }: BookingCardProps) => {
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
      className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm will-change-transform"
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
          <img 
            src={salonImage} 
            alt={salonName} 
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover" 
          />
        </div>

        <div className="p-6 sm:p-7">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-4xl font-extrabold tracking-tight text-foreground">{salonName}</h2>
              <p className="mt-1 text-lg text-muted-foreground">
                📍 {[b.salons?.city, b.salons?.address || b.salons?.location].filter(Boolean).join(", ") || "Address unavailable"}
              </p>
            </div>
            <span className="rounded-full bg-primary px-3 py-1 text-sm font-bold text-primary-foreground">
              {status === "accepted" || status === "confirmed" ? "Confirmed" : status}
            </span>
          </div>

          <div className="grid gap-4 border-y border-border py-5 sm:grid-cols-2">
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-xl font-semibold text-foreground">
                <Scissors className="h-5 w-5 text-primary" /> {serviceName}
              </p>
              <p className="flex items-center gap-2 text-xl text-foreground/70">
                <Clock3 className="h-5 w-5 text-primary" /> {formatTimeSlot(b.time_slot)}
              </p>
            </div>

            <div className="space-y-3">
              <p className="flex items-center gap-2 text-xl text-foreground/70">
                <CalendarDays className="h-5 w-5 text-primary" /> {toDateLabel(b.booking_date)}
              </p>
              <p className="flex items-center gap-2 text-xl text-foreground/70">
                <MapPin className="h-5 w-5 text-primary" /> {b.salons?.city || "Location unavailable"}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-4xl font-extrabold text-primary">{formatPrice(price)}</p>

            {/* OTP Display for active bookings - Valid until completed/cancelled */}
            {isOTPActive(status) && b.arrival_otp && (
              <div className="w-full">
                <div className="pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">
                    Arrival Code (Show at Salon)
                  </p>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex gap-1.5">
                      {b.arrival_otp.split('').map((digit: string, i: number) => (
                        <div key={i}
                             className="w-9 h-10 bg-primary/10 border-2 border-primary/30 rounded-lg
                                        flex items-center justify-center text-lg font-black text-primary">
                          {digit}
                        </div>
                      ))}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Valid until done</p>
                      <p className="text-xs text-success font-medium mt-0.5">● Active</p>
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

          {!showActions && isReviewableStatus(status) ? (
            existingReview ? (
              <div className="mt-4 rounded-2xl border border-border bg-muted/30 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your review</p>
                <div className="mt-1.5 flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-4 w-4 ${star <= existingReview.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                    />
                  ))}
                </div>
                {existingReview.comment ? (
                  <p className="mt-2 text-sm text-foreground/90">{existingReview.comment}</p>
                ) : null}
              </div>
            ) : (
              <div className="mt-4">
                <Button
                  variant="outline"
                  className="h-10 gap-2 rounded-full"
                  onClick={() => onLeaveReview?.(b)}
                >
                  <Star className="h-4 w-4" /> Leave a review
                </Button>
              </div>
            )
          ) : null}
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
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<BookingTab>(
    () => (location.state as { initialTab?: BookingTab } | null)?.initialTab ?? "upcoming"
  );
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [cancelPendingId, setCancelPendingId] = useState<string | null>(null);
  const [showCancelPopup, setShowCancelPopup] = useState(false);
  const [cancelledBooking, setCancelledBooking] = useState<any>(null);
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<any>(null);
  const [showCompletionCelebration, setShowCompletionCelebration] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<number | null>(null);

  // Review submission state (additive — customer-facing review flow)
  const [myReviews, setMyReviews] = useState<Record<string, ReviewInfo>>({});
  const [reviewTarget, setReviewTarget] = useState<any>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

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

  // Fetch the customer's own reviews so completed bookings can show a read-only
  // review instead of the "Leave a review" button. Purely additive — does not
  // touch fetchBookings or the realtime subscription below.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("salon_reviews")
        .select("id, booking_id, rating, comment")
        .eq("customer_id", user.id);

      if (cancelled) return;
      if (error) {
        console.error("MY_REVIEWS_FETCH_ERROR", error);
        return;
      }

      const map: Record<string, ReviewInfo> = {};
      (data || []).forEach((row: any) => {
        if (row.booking_id) {
          map[row.booking_id] = { id: row.id, rating: row.rating, comment: row.comment };
        }
      });
      setMyReviews(map);
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, bookings.length]);

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
    setFetchError(null);

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
      .from("bookings")
      .select(BOOKING_SELECT)
      .eq("customer_id", user.id)
      .order("booking_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("BOOKINGS_FETCH_ERROR:", error);
      // Never mask a real query failure as "zero bookings" — keep whatever
      // bookings were already loaded (if any) and surface a real error state
      // instead, so the UI can offer Retry rather than a misleading empty view.
      setFetchError(error.message || "Unable to load your bookings.");
    } else {
      const normalizedData = (data || []).map((b: any) => ({
        ...b,
        user_id: b.customer_id,
        barber_id: b.stylist_id,
        time_slot: b.booking_time,
        arrival_otp: b.otp,
        customer_first_name: b.customer_profiles?.first_name || null,
        customer_last_name: b.customer_profiles?.last_name || null,
        customer_phone: b.customer_profiles?.phone || null,
        email: b.customer_profiles?.email || null,
        barbers: b.barbers,
      }));

      const bookingsWithOtp = await Promise.all(
        normalizedData.map(async (booking: any) => {
          if (!isOTPActive(booking.status) || booking.arrival_otp) {
            return booking;
          }

          const arrivalOtp = generateOTP();
          const { error: otpError } = await supabase
            .from("bookings")
            .update({ otp: arrivalOtp } as any)
            .eq("id", booking.id)
            .eq("customer_id", user.id);

          if (otpError) {
            console.warn("BOOKING_OTP_BACKFILL_FAILED:", otpError);
            return booking;
          }

          return { ...booking, arrival_otp: arrivalOtp, otp: arrivalOtp };
        })
      );

      setBookings(bookingsWithOtp);
      setLastFetchTime(Date.now());
      console.log("✅ BOOKINGS: Fetched", data?.length || 0, "bookings from database");
      // Debug: Log arrival_otp for each booking
      bookingsWithOtp.forEach((booking: any, idx: number) => {
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
          ["pending", "waiting", "confirmed", "accepted", "in_progress"].includes(normalizeStatus(b.status))
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
        .from("bookings")
        .update({ status: "cancelled" } as any)
        .eq("id", cancelPendingId)
        .eq("customer_id", user.id)
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
        .from("bookings")
        .update({
          booking_date: newDate,
          booking_time: newTime,
        } as any)
        .eq("id", rescheduleTarget.id)
        .eq("customer_id", user.id)
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

  const handleOpenReview = (booking: any) => {
    setReviewTarget(booking);
    setReviewRating(0);
    setReviewComment("");
  };

  const handleSubmitReview = async () => {
    if (!reviewTarget || !user?.id) {
      toast.error("Unable to submit review.");
      return;
    }
    if (reviewRating < 1) {
      toast.error("Please select a star rating.");
      return;
    }

    setSubmittingReview(true);
    try {
      const { data, error } = await supabase
        .from("salon_reviews")
        .insert({
          customer_id: user.id,
          salon_id: reviewTarget.salon_id,
          booking_id: reviewTarget.id,
          rating: reviewRating,
          comment: reviewComment.trim() || null,
        } as any)
        .select("id, booking_id, rating, comment")
        .single();

      if (error) throw error;

      setMyReviews((prev) => ({
        ...prev,
        [reviewTarget.id]: { id: data.id, rating: data.rating, comment: data.comment },
      }));
      toast.success("Thanks for your review!");
      setReviewTarget(null);
      setReviewRating(0);
      setReviewComment("");
    } catch (error: any) {
      console.error("REVIEW_SUBMIT_ERROR", error);
      toast.error(error.message || "Failed to submit review.");
    } finally {
      setSubmittingReview(false);
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
            table: "bookings",
            filter: `customer_id=eq.${user.id}`,
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
    <div className="min-h-screen bg-muted/40">
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

      {/* Leave a Review Modal (additive — customer-facing review submission) */}
      <Dialog open={!!reviewTarget} onOpenChange={(open) => { if (!open) setReviewTarget(null); }}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Leave a review</DialogTitle>
          </DialogHeader>
          {reviewTarget ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {reviewTarget.salons?.name || "Salon"} · {reviewTarget.services?.name || "Service"}
              </p>
              <div className="flex items-center justify-center gap-2 py-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    className="p-1"
                    aria-label={`${star} star${star === 1 ? "" : "s"}`}
                  >
                    <Star
                      className={`h-8 w-8 transition-colors ${star <= reviewRating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                    />
                  </button>
                ))}
              </div>
              <Textarea
                placeholder="Share details about your experience (optional)"
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewTarget(null)} disabled={submittingReview}>
              Cancel
            </Button>
            <Button onClick={handleSubmitReview} disabled={submittingReview || reviewRating < 1}>
              {submittingReview ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Submit review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div data-bookings-shell className="mx-auto max-w-5xl px-4 pb-12 pt-10 sm:px-6">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-5 w-5" />
          <span className="text-sm font-medium">Back</span>
        </button>

        <div className="mb-8">
          <div className="flex items-baseline justify-between flex-wrap gap-4">
            <h1 className="font-display text-5xl font-extrabold tracking-tight text-foreground">My Bookings</h1>
            {!(fetching && bookings.length === 0) && !fetchError && (
              <span className="text-sm font-semibold text-primary bg-primary/10 border border-primary/20 rounded-full px-4 py-1">
                Total Bookings: {bookings.length}
              </span>
            )}
          </div>
          <div className="mt-6 flex gap-6 border-b border-border text-xl font-bold uppercase tracking-[0.08em]">
            {(() => {
              // While the very first fetch is still in flight (or it failed), the
              // real counts aren't known yet — show plain labels instead of a
              // misleading "(0)" that looks identical to a genuinely-empty result.
              const countsKnown = !(fetching && bookings.length === 0) && !fetchError;
              return [
                { key: "upcoming", label: countsKnown ? `Upcoming (${upcomingBookings.length})` : "Upcoming" },
                { key: "past", label: countsKnown ? `Past (${pastBookings.length})` : "Past" },
                { key: "cancelled", label: countsKnown ? `Cancelled (${cancelledBookings.length})` : "Cancelled" },
              ];
            })().map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as BookingTab)}
                className={`pb-3 transition ${
                  activeTab === tab.key
                    ? "border-b-4 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {!(fetching && bookings.length === 0) && !fetchError && (
            <div className="mt-4 text-sm text-muted-foreground font-medium">
              Showing {filteredBookings.length} of {bookings.length} bookings
            </div>
          )}
        </div>

        {fetching && bookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading your bookings…</p>
          </div>
        ) : fetchError ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-12 text-center">
            <p className="font-semibold text-destructive">Unable to load your bookings.</p>
            <p className="mt-1 text-sm text-muted-foreground">{fetchError}</p>
            <Button className="mt-5" onClick={() => fetchBookings(true)}>
              Retry
            </Button>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
            <p>No bookings in this section yet.</p>
            <Button variant="outline" className="mt-5" onClick={() => navigate("/salons")}>
              Explore salons
            </Button>
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
                  existingReview={myReviews[b.id] || null}
                  onLeaveReview={handleOpenReview}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


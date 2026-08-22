import { Check, Loader2 } from "lucide-react";
import TurnstileCaptcha from "@/components/TurnstileCaptcha";
import { useBookingDraft } from "@/contexts/BookingDraftContext";

interface BookingSummaryCardProps {
  showConfirmActions?: boolean;
}

export function BookingSummaryCard({ showConfirmActions = false }: BookingSummaryCardProps) {
  const {
    activeCustomer,
    selectedServices,
    assignmentResult,
    date,
    time,
    turnstileRef,
    captchaToken,
    setCaptchaToken,
    booking,
    verifyingCaptcha,
    submitBooking,
  } = useBookingDraft();

  const customerName = `${activeCustomer.firstName.trim()} ${activeCustomer.lastName.trim()}`.trim();
  const totalDuration = selectedServices.reduce((sum, s) => sum + (s.duration || 30), 0);
  const totalPrice = selectedServices.reduce((sum, s) => sum + (s.price || 0), 0);
  const estimatedWait = assignmentResult?.estimatedWait ?? (selectedServices.length > 0 ? Math.max(10, Math.ceil(totalDuration * 0.75)) : null);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-accent p-6 text-white shadow-2xl sm:p-8">
      <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-accent opacity-20 blur-3xl" />
      <div className="relative z-10 space-y-6">
        <header className="space-y-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 backdrop-blur-md">
            <Check className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">Booking Summary</p>
            <h2 className="font-display text-2xl font-extrabold leading-tight sm:text-3xl">Ready to join</h2>
          </div>
        </header>

        <div className="space-y-1">
          <div className="flex items-center justify-between border-b border-white/10 py-3">
            <span className="text-xs font-medium text-white/60 sm:text-sm">Customer</span>
            <span className="text-right text-xs font-bold sm:text-sm">{customerName || "Enter name"}</span>
          </div>
          <div className="flex items-center justify-between border-b border-white/10 py-3">
            <span className="text-xs font-medium text-white/60 sm:text-sm">Services</span>
            <span className="text-right text-xs font-bold sm:text-sm">
              {selectedServices.length > 0 ? selectedServices.map((s) => s.name).join(", ") : "Select services"}
            </span>
          </div>
          <div className="flex items-center justify-between border-b border-white/10 py-3">
            <span className="text-xs font-medium text-white/60 sm:text-sm">Stylist</span>
            <span className="text-right text-xs font-bold sm:text-sm">{assignmentResult?.barberName || "Assigning..."}</span>
          </div>
          {date && (
            <div className="flex items-center justify-between border-b border-white/10 py-3">
              <span className="text-xs font-medium text-white/60 sm:text-sm">Date</span>
              <span className="text-right text-xs font-bold sm:text-sm">{date}</span>
            </div>
          )}
          {time && (
            <div className="flex items-center justify-between border-b border-white/10 py-3">
              <span className="text-xs font-medium text-white/60 sm:text-sm">Time</span>
              <span className="text-right text-xs font-bold sm:text-sm">{time}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 pt-5">
            <div className="rounded-lg bg-white/10 p-3.5 backdrop-blur-sm">
              <p className="mb-1.5 text-xs text-white/60">Est. Wait</p>
              <p className="font-display text-xl font-bold">{estimatedWait ?? "—"}{estimatedWait ? " min" : ""}</p>
            </div>
            <div className="rounded-lg bg-white/10 p-3.5 backdrop-blur-sm">
              <p className="mb-1.5 text-xs text-white/60">Duration</p>
              <p className="font-display text-xl font-bold">{totalDuration} min</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-white/10 p-4.5 backdrop-blur-sm">
          <span className="text-sm font-bold text-white/80">Total Amount</span>
          <div className="text-right">
            <p className="font-display text-3xl font-extrabold">INR {totalPrice}</p>
            <p className="text-xs text-white/60">incl. all taxes</p>
          </div>
        </div>

        {showConfirmActions ? (
          <div className="space-y-3.5">
            <div className="rounded-lg border border-white/30 bg-white/20 p-5 backdrop-blur-sm">
              <p className="mb-3 text-xs font-semibold text-white/70">Security Verification</p>
              <div className="flex justify-center">
                <TurnstileCaptcha ref={turnstileRef} onTokenChange={setCaptchaToken} theme="dark" className="min-h-[120px] w-full sm:min-h-[130px]" />
              </div>
            </div>
            <button
              onClick={submitBooking}
              disabled={!date || selectedServices.length === 0 || !time || booking || verifyingCaptcha || !captchaToken}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3.5 px-5 text-sm font-bold text-white shadow-lg shadow-primary/20 transition hover:scale-[1.01] hover:bg-accent active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 sm:text-base"
            >
              {booking ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Processing...
                </>
              ) : (
                "Confirm Booking"
              )}
            </button>
            <p className="px-4 text-center text-xs leading-relaxed text-white/40">
              By joining the queue, you agree to our Terms of Service and Privacy Policy. Cancellation fees may apply within 2 hours of slot.
            </p>
          </div>
        ) : (
          <p className="rounded-lg bg-white/10 px-4 py-3 text-center text-sm font-semibold text-white/70">
            Complete all steps to confirm booking
          </p>
        )}
      </div>
    </div>
  );
}

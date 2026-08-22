import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { BookingPageShell } from "@/components/booking/BookingPageShell";
import BookingSuccess from "@/components/BookingSuccess";
import { useBookingDraft } from "@/contexts/BookingDraftContext";

export default function BookingConfirmPage() {
  const navigate = useNavigate();
  const {
    customer,
    setCustomer,
    activeCustomer,
    hasSavedProfile,
    savedProfile,
    bookingForSomeoneElse,
    setBookingForSomeoneElse,
    saveProfile,
    confirmedBookingState,
    loadingSalon,
    exitFlow,
  } = useBookingDraft();

  const [touched, setTouched] = useState({ firstName: false, lastName: false, phone: false });

  if (loadingSalon) return null;

  if (confirmedBookingState) {
    return (
      <BookingSuccess
        {...confirmedBookingState}
        onViewBookings={() => navigate("/bookings")}
        onModify={() => exitFlow()}
      />
    );
  }

  const firstNameError = touched.firstName && !activeCustomer.firstName.trim() ? "First name is required" : "";
  const lastNameError = touched.lastName && !activeCustomer.lastName.trim() ? "Last name is required" : "";
  const phoneError = touched.phone && !activeCustomer.phone.trim() ? "Phone number is required" : "";

  return (
    <BookingPageShell
      stepNumber={5}
      title="Your Information"
      subtitle="Confirm your details to join the queue"
      onBack={() => navigate("/booking/time")}
      showConfirmActions
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-xs font-semibold text-primary sm:text-sm">Full Name</label>
            <Input
              value={`${activeCustomer.firstName} ${activeCustomer.lastName}`.trim()}
              onChange={(event) => {
                const [first, ...last] = event.target.value.trim().split(" ");
                setCustomer((prev) => ({ ...prev, firstName: first || "", lastName: last.join(" ") }));
              }}
              onBlur={() => setTouched((prev) => ({ ...prev, firstName: true, lastName: true }))}
              placeholder="Johnathan Doe"
              readOnly={!bookingForSomeoneElse && hasSavedProfile}
              className="h-11 rounded-lg border-2 border-border bg-background px-4 text-sm placeholder:text-muted-foreground/50 focus-visible:ring-2 focus-visible:ring-accent/20 sm:h-12 sm:text-base"
            />
            {(firstNameError || lastNameError) && <p className="mt-1 text-xs text-destructive sm:text-sm">{firstNameError || lastNameError}</p>}
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold text-primary sm:text-sm">Phone Number</label>
            <Input
              value={activeCustomer.phone}
              onChange={(event) => setCustomer((prev) => ({ ...prev, phone: event.target.value }))}
              onBlur={() => setTouched((prev) => ({ ...prev, phone: true }))}
              placeholder="+91 98765 43210"
              inputMode="tel"
              readOnly={!bookingForSomeoneElse && hasSavedProfile}
              className="h-11 rounded-lg border-2 border-border bg-background px-4 text-sm placeholder:text-muted-foreground/50 focus-visible:ring-2 focus-visible:ring-accent/20 sm:h-12 sm:text-base"
            />
            {phoneError && <p className="mt-1 text-xs text-destructive sm:text-sm">{phoneError}</p>}
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold text-muted-foreground sm:text-sm">
              Alternative Number <span className="text-muted-foreground/60">(Optional)</span>
            </label>
            <Input
              value={activeCustomer.altPhone || ""}
              onChange={(event) => setCustomer((prev) => ({ ...prev, altPhone: event.target.value }))}
              placeholder="For salon to call if needed"
              inputMode="tel"
              className="h-11 rounded-lg border-2 border-border bg-background px-4 text-sm placeholder:text-muted-foreground/50 focus-visible:ring-2 focus-visible:ring-accent/20 sm:h-12 sm:text-base"
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold text-muted-foreground sm:text-sm">Notes (Optional)</label>
          <textarea
            value={customer.notes}
            onChange={(event) => setCustomer((prev) => ({ ...prev, notes: event.target.value }))}
            placeholder="Special requirements or hair history..."
            rows={3}
            className="w-full rounded-lg border-2 border-border bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-accent/10"
          />
        </div>

        {hasSavedProfile && (
          <label className="flex cursor-pointer items-center gap-2.5 pt-1">
            <input
              type="checkbox"
              checked={!bookingForSomeoneElse}
              onChange={(e) => {
                const next = !e.target.checked;
                setBookingForSomeoneElse(next);
                setTouched({ firstName: false, lastName: false, phone: false });
                if (next) {
                  setCustomer((prev) => ({ ...prev, firstName: "", lastName: "", phone: "" }));
                } else {
                  setCustomer((prev) => ({ ...prev, ...savedProfile }));
                }
              }}
              className="h-4 w-4 rounded-md border-border text-primary sm:h-5 sm:w-5"
            />
            <span className="text-sm font-medium text-muted-foreground sm:text-base">Use saved profile</span>
          </label>
        )}

        {!hasSavedProfile && (
          <button
            type="button"
            onClick={() =>
              saveProfile({
                firstName: activeCustomer.firstName,
                lastName: activeCustomer.lastName,
                phone: activeCustomer.phone,
              })
            }
            className="text-xs font-semibold text-primary hover:underline sm:text-sm"
          >
            Save these details for faster booking next time
          </button>
        )}
      </div>
    </BookingPageShell>
  );
}

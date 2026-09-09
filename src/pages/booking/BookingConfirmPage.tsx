import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, Phone, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { BookingPageShell } from "@/components/booking/BookingPageShell";
import BookingSuccess from "@/components/BookingSuccess";
import { useBookingDraft } from "@/contexts/BookingDraftContext";

const getSalonImageSrc = (imageUrl: string | null | undefined) => {
  if (!imageUrl) return "/default-salon.jpg";
  if (imageUrl.startsWith("http") || imageUrl.startsWith("/")) return imageUrl;
  const { data } = supabase.storage.from("salon-images").getPublicUrl(imageUrl);
  return data.publicUrl || "/default-salon.jpg";
};

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
    selectedServices,
    date,
    time,
    salon,
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

  if (selectedServices.length === 0) {
    navigate("/booking/service");
    return null;
  }

  if (!date) {
    navigate("/booking/date");
    return null;
  }

  if (!time) {
    navigate("/booking/time");
    return null;
  }

  const firstNameError = touched.firstName && !activeCustomer.firstName.trim() ? "First name is required" : "";
  const lastNameError = touched.lastName && !activeCustomer.lastName.trim() ? "Last name is required" : "";
  const phoneError = touched.phone && !activeCustomer.phone.trim() ? "Phone number is required" : "";
  const fieldsLocked = !bookingForSomeoneElse && hasSavedProfile;

  return (
    <BookingPageShell
      stepNumber={5}
      title="Confirm your details"
      subtitle="Review your booking summary and confirm when you're ready"
      onBack={() => navigate("/booking/time")}
      showConfirmActions
    >
      {salon && (
        <div className="mb-5 flex items-center gap-3">
          <img
            src={getSalonImageSrc(salon.image_url)}
            alt=""
            className="h-11 w-11 shrink-0 rounded-xl border border-border object-cover"
          />
          <p className="truncate text-sm font-semibold text-foreground">{salon.name}</p>
        </div>
      )}

      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="booking-full-name" className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <User className="h-3.5 w-3.5" aria-hidden="true" />
              Full name
            </label>
            <Input
              id="booking-full-name"
              value={`${activeCustomer.firstName} ${activeCustomer.lastName}`.trim()}
              onChange={(event) => {
                const [first, ...last] = event.target.value.trim().split(" ");
                setCustomer((prev) => ({ ...prev, firstName: first || "", lastName: last.join(" ") }));
              }}
              onBlur={() => setTouched((prev) => ({ ...prev, firstName: true, lastName: true }))}
              placeholder="Johnathan Doe"
              readOnly={fieldsLocked}
              className={`h-11 rounded-xl border-2 px-4 text-sm placeholder:text-muted-foreground/50 focus-visible:ring-2 focus-visible:ring-accent/20 sm:h-12 sm:text-base ${
                fieldsLocked ? "border-border bg-muted text-foreground" : "border-border bg-background"
              }`}
            />
            {(firstNameError || lastNameError) && <p className="mt-1 text-xs text-destructive sm:text-sm">{firstNameError || lastNameError}</p>}
            {fieldsLocked && <p className="mt-1 text-xs text-muted-foreground">Auto-filled from your saved profile</p>}
          </div>
          <div>
            <label htmlFor="booking-phone" className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Phone className="h-3.5 w-3.5" aria-hidden="true" />
              Phone number
            </label>
            <Input
              id="booking-phone"
              value={activeCustomer.phone}
              onChange={(event) => setCustomer((prev) => ({ ...prev, phone: event.target.value }))}
              onBlur={() => setTouched((prev) => ({ ...prev, phone: true }))}
              placeholder="+91 98765 43210"
              inputMode="tel"
              readOnly={fieldsLocked}
              className={`h-11 rounded-xl border-2 px-4 text-sm placeholder:text-muted-foreground/50 focus-visible:ring-2 focus-visible:ring-accent/20 sm:h-12 sm:text-base ${
                fieldsLocked ? "border-border bg-muted text-foreground" : "border-border bg-background"
              }`}
            />
            {phoneError && <p className="mt-1 text-xs text-destructive sm:text-sm">{phoneError}</p>}
          </div>
          <div>
            <label htmlFor="booking-alt-phone" className="mb-2 block text-xs font-semibold text-muted-foreground">
              Alternative number <span className="text-muted-foreground/60">(optional)</span>
            </label>
            <Input
              id="booking-alt-phone"
              value={activeCustomer.altPhone || ""}
              onChange={(event) => setCustomer((prev) => ({ ...prev, altPhone: event.target.value }))}
              placeholder="For the salon to call if needed"
              inputMode="tel"
              className="h-11 rounded-xl border-2 border-border bg-background px-4 text-sm placeholder:text-muted-foreground/50 focus-visible:ring-2 focus-visible:ring-accent/20 sm:h-12 sm:text-base"
            />
          </div>
        </div>

        <div>
          <label htmlFor="booking-notes" className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
            Notes <span className="text-muted-foreground/60">(optional)</span>
          </label>
          <textarea
            id="booking-notes"
            value={customer.notes}
            onChange={(event) => setCustomer((prev) => ({ ...prev, notes: event.target.value }))}
            placeholder="Special requirements or hair history..."
            rows={3}
            className="w-full rounded-xl border-2 border-border bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-accent/10"
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

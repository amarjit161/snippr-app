import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { BookingPageShell } from "@/components/booking/BookingPageShell";
import { SlotPicker } from "@/components/booking/SlotPicker";
import { useBookingDraft } from "@/contexts/BookingDraftContext";

export default function BookingTimePage() {
  const navigate = useNavigate();
  const { salon, date, time, setTime, assignmentResult, loadingSalon } = useBookingDraft();

  if (loadingSalon) return null;

  if (!date) {
    navigate("/booking/date");
    return null;
  }

  return (
    <BookingPageShell
      stepNumber={4}
      title="Select Time"
      subtitle="Pick an available slot"
      onBack={() => navigate("/booking/date")}
      onNext={() => {
        if (!time) {
          toast.error("Please select a time slot");
          return;
        }
        navigate("/booking/confirm");
      }}
    >
      <div className="space-y-3">
        {salon && assignmentResult?.barberId ? (
          <SlotPicker
            key={`${assignmentResult.barberId}-${date}`}
            salonId={salon.id}
            date={date}
            barberId={assignmentResult.barberId}
            selectedSlot={time}
            onSlotSelect={(timeValue) => setTime(timeValue)}
          />
        ) : (
          <div className="rounded-lg border-2 border-border bg-muted p-5 text-center">
            <p className="text-sm text-muted-foreground">Please wait for stylist assignment to complete</p>
          </div>
        )}
      </div>
    </BookingPageShell>
  );
}

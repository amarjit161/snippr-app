import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BookingPageShell } from "@/components/booking/BookingPageShell";
import { SlotPicker } from "@/components/booking/SlotPicker";
import { useBookingDraft } from "@/contexts/BookingDraftContext";

const getSalonImageSrc = (imageUrl: string | null | undefined) => {
  if (!imageUrl) return "/default-salon.jpg";
  if (imageUrl.startsWith("http") || imageUrl.startsWith("/")) return imageUrl;
  const { data } = supabase.storage.from("salon-images").getPublicUrl(imageUrl);
  return data.publicUrl || "/default-salon.jpg";
};

const formatSelectedDate = (iso: string): string => {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "";
  const localDate = new Date(y, m - 1, d);
  return localDate.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
};

export default function BookingTimePage() {
  const navigate = useNavigate();
  const { salon, date, time, timeLabel, setTime, setTimeLabel, assignmentResult, loadingSalon } = useBookingDraft();

  if (loadingSalon) return null;

  if (!date) {
    navigate("/booking/date");
    return null;
  }

  return (
    <BookingPageShell
      stepNumber={4}
      title="Choose a time"
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

      {date && (
        <p className="mb-4 text-sm font-semibold text-foreground">{formatSelectedDate(date)}</p>
      )}

      <div className="space-y-4">
        {salon && assignmentResult?.barberId ? (
          <SlotPicker
            key={`${assignmentResult.barberId}-${date}`}
            salonId={salon.id}
            date={date}
            barberId={assignmentResult.barberId}
            selectedSlot={time}
            onSlotSelect={(timeValue, timeLabelValue) => {
              setTime(timeValue);
              setTimeLabel(timeLabelValue);
            }}
          />
        ) : (
          <div className="rounded-2xl border border-border bg-card p-5 text-center">
            <p className="text-sm text-muted-foreground">Please wait for stylist assignment to complete</p>
          </div>
        )}

        {time && (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3.5">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Selected time</p>
            <p className="mt-1 font-display text-lg font-bold text-foreground">{timeLabel || time}</p>
          </div>
        )}
      </div>
    </BookingPageShell>
  );
}

import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { BookingPageShell } from "@/components/booking/BookingPageShell";
import { useBookingDraft, getMinDate, getMaxDate } from "@/contexts/BookingDraftContext";

export default function BookingDatePage() {
  const navigate = useNavigate();
  const { date, setDate, nextQueuePosition, assignmentResult, loadingSalon } = useBookingDraft();

  if (loadingSalon) return null;

  return (
    <BookingPageShell
      stepNumber={3}
      title="Choose a Date"
      subtitle="Up to 30 days ahead"
      onBack={() => navigate("/booking/stylist")}
      onNext={() => {
        if (!date) {
          toast.error("Please select a date");
          return;
        }
        navigate("/booking/time");
      }}
    >
      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-semibold text-primary">Date</label>
          <Input
            type="date"
            required
            min={getMinDate()}
            max={getMaxDate()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-12 w-full rounded-lg border-2 border-border bg-background px-4 text-base text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-accent/10"
          />
        </div>

        {nextQueuePosition != null && (
          <div className="rounded-lg border-l-4 border-primary bg-secondary p-4 sm:p-5">
            <p className="mb-1.5 text-xs font-semibold text-primary sm:text-sm">CURRENT QUEUE</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              You'll join at position <span className="font-semibold text-foreground">#{nextQueuePosition}</span>
              {assignmentResult?.barberName ? ` with ${assignmentResult.barberName}` : ""}. Your position in the live queue will be locked instantly once confirmed.
            </p>
          </div>
        )}
      </div>
    </BookingPageShell>
  );
}

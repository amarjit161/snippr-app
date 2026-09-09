import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { CalendarDays, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { BookingPageShell } from "@/components/booking/BookingPageShell";
import { useBookingDraft, getMinDate, getMaxDate } from "@/contexts/BookingDraftContext";

const getSalonImageSrc = (imageUrl: string | null | undefined) => {
  if (!imageUrl) return "/default-salon.jpg";
  if (imageUrl.startsWith("http") || imageUrl.startsWith("/")) return imageUrl;
  const { data } = supabase.storage.from("salon-images").getPublicUrl(imageUrl);
  return data.publicUrl || "/default-salon.jpg";
};

// Mirrors getMaxDate()'s own +N-day technique (BookingDraftContext.tsx) so this
// quick-pick value can never disagree with the real minimum/maximum date logic.
const getTomorrowDate = (): string => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split("T")[0];
};

const formatSelectedDate = (iso: string): string => {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "";
  const localDate = new Date(y, m - 1, d);
  return localDate.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
};

export default function BookingDatePage() {
  const navigate = useNavigate();
  const { date, setDate, nextQueuePosition, assignmentResult, loadingSalon, salon } = useBookingDraft();

  if (loadingSalon) return null;

  const todayISO = getMinDate();
  const maxDateISO = getMaxDate();
  const tomorrowISO = getTomorrowDate();

  return (
    <BookingPageShell
      stepNumber={3}
      title="Choose a date"
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

      <div className="space-y-4">
        {/* Quick picks — same setDate() setter as the date input below */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setDate(todayISO)}
            aria-pressed={date === todayISO}
            className={`flex min-h-[44px] flex-col items-start rounded-2xl border p-4 text-left transition-colors ${
              date === todayISO
                ? "border-primary bg-primary/[0.08]"
                : "border-border bg-card hover:border-primary/40"
            }`}
          >
            <span className="text-sm font-semibold text-foreground">Today</span>
            <span className="text-xs text-muted-foreground">{formatSelectedDate(todayISO).split(",")[0]}</span>
          </button>
          <button
            type="button"
            onClick={() => setDate(tomorrowISO)}
            aria-pressed={date === tomorrowISO}
            className={`flex min-h-[44px] flex-col items-start rounded-2xl border p-4 text-left transition-colors ${
              date === tomorrowISO
                ? "border-primary bg-primary/[0.08]"
                : "border-border bg-card hover:border-primary/40"
            }`}
          >
            <span className="text-sm font-semibold text-foreground">Tomorrow</span>
            <span className="text-xs text-muted-foreground">{formatSelectedDate(tomorrowISO).split(",")[0]}</span>
          </button>
        </div>

        {/* Native date input — unchanged validation, same min/max/value/onChange contract */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <label htmlFor="booking-date-input" className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            Or pick another date
          </label>
          <Input
            id="booking-date-input"
            type="date"
            required
            min={todayISO}
            max={maxDateISO}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-12 w-full rounded-xl border-2 border-border bg-background px-4 text-base text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-accent/10"
          />
        </div>

        {/* Selected-date confirmation — purely derived display, same date state */}
        {date && (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3.5">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Selected date</p>
            <p className="mt-1 font-display text-lg font-bold text-foreground">{formatSelectedDate(date)}</p>
          </div>
        )}

        {nextQueuePosition != null && (
          <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Users className="h-4 w-4 text-primary" aria-hidden="true" />
            </div>
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-[0.1em] text-primary">Current queue</p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                You&apos;ll join at position <span className="font-semibold text-foreground">#{nextQueuePosition}</span>
                {assignmentResult?.barberName ? ` with ${assignmentResult.barberName}` : ""}. Your position in the live queue will be locked instantly once confirmed.
              </p>
            </div>
          </div>
        )}
      </div>
    </BookingPageShell>
  );
}

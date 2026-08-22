import { ReactNode } from "react";
import { motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import Header from "@/components/Header";
import { BookingProgressIndicator } from "@/components/booking/BookingProgressIndicator";
import { BookingSummaryCard } from "@/components/booking/BookingSummaryCard";
import { useAuth } from "@/contexts/AuthContext";
import { useBookingDraft } from "@/contexts/BookingDraftContext";

interface BookingPageShellProps {
  stepNumber: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  showConfirmActions?: boolean;
}

export function BookingPageShell({
  stepNumber,
  title,
  subtitle,
  children,
  onBack,
  onNext,
  nextLabel = "Next",
  nextDisabled = false,
  showConfirmActions = false,
}: BookingPageShellProps) {
  const { signOut, user, profile } = useAuth();
  const { salon, exitFlow } = useBookingDraft();

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-background text-foreground">
      <Header onSignOut={signOut} userName={user?.email || "User"} userEmail={user?.email || undefined} profileName={profile?.name || undefined} isAdmin={false} />

      <div className="mx-auto w-full px-3 pb-20 pt-8 sm:px-4 md:px-6 xl:max-w-6xl xl:px-0">
        <button
          onClick={() => (onBack ? onBack() : exitFlow())}
          className="mb-4 flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          {salon ? `Back to ${salon.name}` : "Back"}
        </button>

        <div className="mb-6">
          <BookingProgressIndicator />
        </div>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12 lg:gap-8">
          <div className="space-y-5 lg:col-span-7">
            <div className="space-y-4 rounded-2xl bg-muted p-5 sm:p-7 md:p-8">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {stepNumber}
                </span>
                <div>
                  <h1 className="font-display text-xl font-bold sm:text-2xl">{title}</h1>
                  {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
                </div>
              </div>
              {children}
            </div>

            {(onBack !== null || onNext) && (
              <div className="flex gap-3">
                <button
                  onClick={() => (onBack ? onBack() : exitFlow())}
                  className="flex-1 rounded-lg border-2 border-border py-3 text-sm font-semibold text-foreground transition hover:border-primary hover:bg-muted sm:py-3.5"
                >
                  Back
                </button>
                {onNext && (
                  <button
                    onClick={onNext}
                    disabled={nextDisabled}
                    className="flex-1 rounded-lg bg-primary py-3 text-sm font-semibold text-white transition hover:bg-accent active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 sm:py-3.5"
                  >
                    {nextLabel}
                  </button>
                )}
              </div>
            )}
          </div>

          <aside className="lg:col-span-5">
            <BookingSummaryCard showConfirmActions={showConfirmActions} />
          </aside>
        </div>
      </div>
    </motion.div>
  );
}

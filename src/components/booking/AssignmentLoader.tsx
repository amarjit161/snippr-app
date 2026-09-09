import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { User, Clock, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import type { BarberScore } from "@/hooks/useSmartBarberAssignment";
import { BarberSelector } from "./BarberSelector";

interface AssignmentResult {
  barberId: string;
  barberName: string;
  workloadScore: number;
  estimatedWait: number;
  completionTime: string;
  reason: string;
}

interface AssignmentLoaderProps {
  isLoading: boolean;
  assignmentResult?: AssignmentResult | null;
  error?: string | null;
  allBarbers?: BarberScore[];
  onBarberChange?: (barber: BarberScore) => void;
}

export function AssignmentLoader({
  isLoading,
  assignmentResult,
  error,
  allBarbers = [],
  onBarberChange,
}: AssignmentLoaderProps) {
  const [displayAssignment, setDisplayAssignment] = useState(false);
  const [showSelector, setShowSelector] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (assignmentResult && !isLoading) {
      // Delay showing result for better UX
      const timer = setTimeout(() => setDisplayAssignment(true), 500);
      return () => clearTimeout(timer);
    }
    setDisplayAssignment(false);
  }, [assignmentResult, isLoading]);

  // Only show "Choose Stylist" button if multiple barbers are available
  const multipleBarbers = allBarbers.length > 1;

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-destructive/20 bg-destructive/5 p-5 sm:p-6"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
          <div>
            <h3 className="font-semibold text-foreground">Couldn&apos;t find a stylist</h3>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            <p className="mt-3 text-xs text-muted-foreground">
              Try selecting fewer services, or go back and choose a different date/time.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center sm:p-8">
        <div className="flex justify-center">
          <motion.div
            animate={shouldReduceMotion ? undefined : { opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10"
          >
            <User className="h-7 w-7 text-primary" aria-hidden="true" />
          </motion.div>
        </div>
        <h3 className="mt-5 font-display text-lg font-bold text-foreground">Finding the best stylist for you</h3>
        <p className="mt-1.5 text-sm text-muted-foreground">This usually takes just a moment.</p>
      </div>
    );
  }

  if (!displayAssignment || !assignmentResult) {
    return null;
  }

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
      className="rounded-2xl border border-border bg-card p-5 sm:p-6"
    >
      <div className="space-y-5">
        {/* Assigned stylist */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success" aria-hidden="true">
              <svg className="h-3 w-3 text-success-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </span>
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-success">Stylist assigned</span>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="font-display text-2xl font-bold text-foreground">{assignmentResult.barberName}</h3>
              {assignmentResult.reason && (
                <p className="mt-1 text-sm text-muted-foreground">{assignmentResult.reason}</p>
              )}
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <User className="h-6 w-6 text-primary" aria-hidden="true" />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-muted p-3.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                Est. wait
              </div>
              <p className="mt-1 font-mono text-lg font-bold text-foreground">{assignmentResult.estimatedWait} min</p>
            </div>
            <div className="rounded-xl bg-muted p-3.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                Ready by
              </div>
              <p className="mt-1 font-mono text-lg font-bold text-foreground">{assignmentResult.completionTime}</p>
            </div>
          </div>
        </div>

        {/* Manual override — pre-existing behavior, unchanged; visual only */}
        {multipleBarbers && (
          <div className="border-t border-border pt-4">
            <button
              type="button"
              onClick={() => setShowSelector(!showSelector)}
              className="flex w-full items-center justify-between rounded-xl bg-muted px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted/70"
            >
              <span>Prefer another stylist?</span>
              {showSelector ? (
                <ChevronUp className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              )}
            </button>

            <AnimatePresence>
              {showSelector && (
                <BarberSelector
                  barbers={allBarbers}
                  selectedBarberId={assignmentResult.barberId}
                  onSelectBarber={(barber) => {
                    if (onBarberChange) {
                      onBarberChange(barber);
                      setShowSelector(false);
                    }
                  }}
                  onClose={() => setShowSelector(false)}
                />
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}

import { motion, AnimatePresence } from "framer-motion";
import { Clock, Star, Zap, Flame, CheckCircle2, X } from "lucide-react";
import type { BarberScore } from "@/hooks/useSmartBarberAssignment";

interface BarberSelectorProps {
  barbers: BarberScore[];
  selectedBarberId: string;
  onSelectBarber: (barber: BarberScore) => void;
  onClose: () => void;
}

export function BarberSelector({
  barbers,
  selectedBarberId,
  onSelectBarber,
  onClose,
}: BarberSelectorProps) {
  if (barbers.length === 0) {
    return null;
  }

  // Get badges for each barber
  const getBadges = (barber: BarberScore, allBarbers: BarberScore[]) => {
    const badges: { label: string; icon: React.ReactNode; className: string }[] = [];

    // Fastest
    const fastest = allBarbers.reduce((min, b) =>
      b.estimatedWait < min.estimatedWait ? b : min
    );
    if (barber.barber.id === fastest.barber.id) {
      badges.push({
        label: "Fastest",
        icon: <Zap size={12} aria-hidden="true" />,
        className: "bg-warning/10 text-warning",
      });
    }

    // Most Popular (lowest queueCount = most available = popular choice)
    const mostAvailable = allBarbers.reduce((min, b) =>
      b.queueCount < min.queueCount ? b : min
    );
    if (barber.barber.id === mostAvailable.barber.id && barber.queueCount === 0) {
      badges.push({
        label: "Available now",
        icon: <CheckCircle2 size={12} aria-hidden="true" />,
        className: "bg-success/10 text-success",
      });
    }

    // Premium (high experience)
    if (barber.barber.experience && barber.barber.experience >= 5) {
      badges.push({
        label: "Premium",
        icon: <Star size={12} aria-hidden="true" />,
        className: "bg-primary/10 text-primary",
      });
    }

    // Recommended (best match)
    if (barber.isBest) {
      badges.push({
        label: "Recommended",
        icon: <Flame size={12} aria-hidden="true" />,
        className: "bg-primary/15 text-primary",
      });
    }

    return badges;
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3 }}
      className="mt-4 border-t border-border pt-4"
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Choose your stylist</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close stylist list"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="space-y-2.5">
        <AnimatePresence mode="wait">
          {barbers.map((barber, index) => {
            const badges = getBadges(barber, barbers);
            const isSelected = barber.barber.id === selectedBarberId;

            return (
              <motion.button
                key={barber.barber.id}
                type="button"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05, duration: 0.2 }}
                onClick={() => onSelectBarber(barber)}
                aria-pressed={isSelected}
                className={`w-full rounded-xl border p-4 text-left transition-colors ${
                  isSelected
                    ? "border-primary bg-primary/[0.08]"
                    : "border-border bg-card hover:border-primary/40"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <p className="font-semibold text-foreground">{barber.barber.name}</p>
                      {isSelected && <CheckCircle2 size={16} className="shrink-0 text-primary" aria-hidden="true" />}
                    </div>

                    {barber.barber.specialization && (
                      <p className="mb-2 text-xs text-muted-foreground">{barber.barber.specialization}</p>
                    )}

                    {badges.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {badges.map((badge) => (
                          <span
                            key={badge.label}
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${badge.className}`}
                          >
                            {badge.icon}
                            {badge.label}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock size={13} aria-hidden="true" />
                        {barber.estimatedWait} min wait
                      </span>
                      <span>Ready by {barber.completionTime}</span>
                    </div>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>

      <p className="mt-3 text-center text-xs text-muted-foreground">
        Select your preferred stylist and proceed to booking
      </p>
    </motion.div>
  );
}

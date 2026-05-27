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
    const badges: { label: string; icon: React.ReactNode; color: string }[] =
      [];

    // Fastest
    const fastest = allBarbers.reduce((min, b) =>
      b.estimatedWait < min.estimatedWait ? b : min
    );
    if (barber.barber.id === fastest.barber.id) {
      badges.push({
        label: "Fastest",
        icon: <Zap size={14} />,
        color: "bg-yellow-100 text-yellow-700",
      });
    }

    // Most Popular (lowest queueCount = most available = popular choice)
    const mostAvailable = allBarbers.reduce((min, b) =>
      b.queueCount < min.queueCount ? b : min
    );
    if (barber.barber.id === mostAvailable.barber.id && barber.queueCount === 0) {
      badges.push({
        label: "Available Now",
        icon: <CheckCircle2 size={14} />,
        color: "bg-green-100 text-green-700",
      });
    }

    // Premium (high experience)
    if (barber.barber.experience && barber.barber.experience >= 5) {
      badges.push({
        label: "Premium",
        icon: <Star size={14} />,
        color: "bg-purple-100 text-purple-700",
      });
    }

    // Recommended (best match)
    if (barber.isBest) {
      badges.push({
        label: "Recommended",
        icon: <Flame size={14} />,
        color: "bg-red-100 text-red-700",
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
      className="mt-4 pt-4 border-t border-gray-200"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800">Choose Your Stylist</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition"
        >
          <X size={18} />
        </button>
      </div>

      <div className="space-y-3">
        <AnimatePresence mode="wait">
          {barbers.map((barber, index) => {
            const badges = getBadges(barber, barbers);
            const isSelected = barber.barber.id === selectedBarberId;

            return (
              <motion.button
                key={barber.barber.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => onSelectBarber(barber)}
                className={`w-full text-left p-3 rounded-lg border-2 transition ${
                  isSelected
                    ? "border-purple-600 bg-purple-50"
                    : "border-gray-200 bg-white hover:border-purple-300"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-gray-900">
                        {barber.barber.name}
                      </p>
                      {isSelected && (
                        <CheckCircle2 size={18} className="text-purple-600" />
                      )}
                    </div>

                    {barber.barber.specialization && (
                      <p className="text-xs text-gray-500 mb-2">
                        {barber.barber.specialization}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2 mb-2">
                      {badges.map((badge) => (
                        <div
                          key={badge.label}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${badge.color}`}
                        >
                          {badge.icon}
                          {badge.label}
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1 text-gray-600">
                        <Clock size={14} className="text-purple-600" />
                        <span>{barber.estimatedWait} min wait</span>
                      </span>
                      <span className="text-gray-500">
                        Ready by {barber.completionTime}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>

      <p className="text-xs text-gray-500 text-center mt-3">
        Select your preferred stylist and proceed to booking
      </p>
    </motion.div>
  );
}

import { useEffect } from "react";
import { motion } from "framer-motion";
import { Heart, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CancelPopupProps {
  booking?: {
    salon_name?: string;
    service_name?: string;
  } | null;
  onReschedule: () => void;
  onClose: () => void;
  canReschedule?: boolean;
}

export function CancelPopup({ booking, onReschedule, onClose, canReschedule = true }: CancelPopupProps) {
  if (!booking) return null;
  useEffect(() => {
    // Auto close after 5 seconds if user doesn't interact
    const timer = setTimeout(() => {
      onClose();
    }, 5000);

    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4"
    >
      {/* Sad popup */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.85, y: 20 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="w-full max-w-sm rounded-3xl bg-white shadow-2xl overflow-hidden"
      >
        {/* Sad animation section */}
        <div className="bg-gradient-to-b from-red-50 to-orange-50 p-8 flex flex-col items-center space-y-4">
          {/* Animated sad heart */}
          <motion.div
            animate={{
              scale: [1, 0.95, 1],
              y: [0, 4, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="relative"
          >
            <Heart className="h-16 w-16 text-red-500 fill-red-500" />
            {/* Tear drops */}
            {[0, 1].map((i) => (
              <motion.div
                key={i}
                animate={{
                  opacity: [0, 1, 0],
                  y: [0, 20, 40],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: i * 0.3,
                }}
                className="absolute -bottom-2 w-1.5 h-1.5 bg-blue-400 rounded-full"
                style={{
                  left: i === 0 ? "-8px" : "8px",
                }}
              />
            ))}
          </motion.div>

          <motion.div
            animate={{ opacity: [0.6, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-center space-y-1"
          >
            <h3 className="font-display text-xl font-bold text-gray-900">Booking Cancelled</h3>
            <p className="text-sm text-gray-600">Your slot has been freed up</p>
          </motion.div>
        </div>

        {/* Booking details */}
        <div className="p-5 space-y-4 border-t border-gray-100">
          <div className="space-y-2">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Cancelled</p>
            <p className="font-semibold text-gray-900">{booking.salon_name}</p>
            <p className="text-sm text-gray-600">{booking.service_name}</p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1 text-gray-700"
              onClick={onClose}
            >
              Done
            </Button>
            <Button
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
              onClick={onReschedule}
              disabled={!canReschedule}
            >
              <Calendar className="h-4 w-4 mr-2" />
              Reschedule
            </Button>
          </div>
          {!canReschedule && (
            <p className="text-xs text-amber-700">Reschedule is disabled after barber acceptance.</p>
          )}
        </div>

        {/* Info message */}
        <motion.div
          animate={{ opacity: [0.5, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="px-5 py-3 bg-purple-50 border-t border-purple-100 text-center text-xs text-purple-700 font-medium"
        >
          💡 Closing in a few seconds...
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

// Celebration page - for when booking is COMPLETED
interface CompletionCelebrationProps {
  booking?: {
    salon_name?: string;
    service_name?: string;
  } | null;
  onClose: () => void;
}

export function CompletionCelebration({ booking, onClose }: CompletionCelebrationProps) {
  if (!booking) return null;
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 4000);

    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-50 bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 flex flex-col items-center justify-center p-4"
    >
      {/* Celebration confetti */}
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: -60, x: Math.random() * 100 - 50 }}
          animate={{ opacity: 1, y: 0, x: 0 }}
          transition={{
            delay: 0.1 * i,
            duration: 0.7,
            ease: "easeOut",
          }}
          className="absolute w-3 h-3 rounded-full bg-white/30"
        />
      ))}

      <div className="space-y-8 text-center max-w-sm">
        {/* Animated celebration circle */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{
            type: "spring",
            stiffness: 200,
            damping: 20,
            delay: 0.2,
          }}
          className="mx-auto h-24 w-24 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center relative"
        >
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-5xl"
          >
            ✨
          </motion.div>
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="space-y-2"
        >
          <h1 className="font-display text-4xl font-extrabold text-white">Service Complete!</h1>
          <p className="text-lg text-white/80">Thank you for visiting!</p>
        </motion.div>

        {/* Details */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.4 }}
          className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-6 space-y-2 text-white/90"
        >
          <p className="font-semibold">{booking.salon_name}</p>
          <p className="text-sm text-white/70">{booking.service_name}</p>
        </motion.div>

        {/* Loading dots */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.4 }}
          className="flex justify-center items-center gap-1.5"
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{
                duration: 1.4,
                repeat: Infinity,
                delay: 0.2 * i,
              }}
              className="w-2 h-2 rounded-full bg-white"
            />
          ))}
        </motion.div>
      </div>

      {/* Background animation */}
      <motion.div
        animate={{
          backgroundPosition: ["0% 0%", "100% 100%"],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          repeatType: "reverse",
        }}
        className="absolute inset-0 opacity-10 -z-10"
        style={{
          background: "radial-gradient(circle at 20% 50%, #fff, transparent), radial-gradient(circle at 80% 80%, #fff, transparent)",
          backgroundSize: "200% 200%",
        }}
      />
    </motion.div>
  );
}

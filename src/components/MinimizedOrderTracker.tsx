import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, X, Clock, Users, Scissors } from "lucide-react";
import gsap from "gsap";

interface MinimizedOrderTrackerProps {
  booking: {
    id: string;
    salon_name: string;
    service_name: string;
    service_price: number;
    position?: number;
    wait_time?: number;
  };
  onClose: () => void;
  isExpanded?: boolean;
}

// Animated barber/styler doing hair cutting
function BarberAnimation() {
  return (
    <div className="relative h-32 w-32 mx-auto flex items-center justify-center">
      {/* Head */}
      <motion.div
        animate={{ y: [0, -2, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-2 w-10 h-10 rounded-full bg-gradient-to-br from-amber-300 to-amber-400 shadow-lg"
      />

      {/* Hair */}
      <motion.div
        animate={{ rotateY: [0, -15, 15, 0] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="absolute top-0 left-2 w-6 h-6 rounded-full bg-amber-700/40 blur-md"
        style={{
          originX: "50%",
          originY: "50%",
        }}
      />

      {/* Scissors */}
      <motion.div
        animate={{
          rotate: [0, -30, 0],
          x: [0, 8, 0],
          y: [-5, 0, -5],
        }}
        transition={{
          duration: 0.8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute top-6 right-4"
      >
        <Scissors className="h-6 w-6 text-purple-600" />
      </motion.div>

      {/* Body */}
      <motion.div
        animate={{ y: [0, -1, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-12 w-8 h-10 rounded-full bg-gradient-to-b from-purple-500 to-purple-600 shadow-lg"
      />

      {/* Arm holding scissors */}
      <motion.div
        animate={{
          rotate: [15, -25, 15],
          x: [0, 4, 0],
        }}
        transition={{
          duration: 0.8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute top-12 right-0 w-2.5 h-8 bg-gradient-to-b from-amber-300 to-amber-400 rounded-full origin-top"
      />

      {/* Sparkly effect for cutting */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            opacity: [0, 1, 0],
            scale: [0, 1, 0],
            x: [0, Math.cos((i * Math.PI) / 1.5) * 30, Math.cos((i * Math.PI) / 1.5) * 50],
            y: [0, Math.sin((i * Math.PI) / 1.5) * 30, Math.sin((i * Math.PI) / 1.5) * 50],
          }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: i * 0.4,
          }}
          className="absolute top-6 right-8 w-1.5 h-1.5 bg-yellow-300 rounded-full shadow-lg"
        />
      ))}
    </div>
  );
}

export function MinimizedOrderTracker({ booking, onClose, isExpanded = false }: MinimizedOrderTrackerProps) {
  const [expanded, setExpanded] = useState(isExpanded);
  const [position, setPosition] = useState(booking.position || 1);
  const [waitTime, setWaitTime] = useState(booking.wait_time || 25);

  // Simulate position updates
  useEffect(() => {
    const interval = setInterval(() => {
      setPosition((prev) => Math.max(1, prev - 1));
      setWaitTime((prev) => Math.max(0, prev - 1));
    }, 8000); // Updates every 8 seconds (simulated)
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 100, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 100, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 400, damping: 40 }}
      className={`fixed bottom-4 right-4 z-40 rounded-3xl bg-white shadow-2xl border border-gray-100 overflow-hidden will-change-transform ${
        expanded ? "w-full max-w-md" : "w-80"
      }`}
    >
      {/* Compact view */}
      <motion.div
        initial={false}
        animate={{ height: expanded ? 0 : "auto", opacity: expanded ? 0 : 1 }}
        transition={{ duration: 0.3 }}
        className="overflow-hidden"
      >
        <div className="p-4 bg-gradient-to-r from-purple-50 to-purple-100">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm text-gray-600">Order Status</p>
              <p className="font-display font-bold text-gray-900">Your turn in ~{waitTime}m</p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setExpanded(true)}
              className="rounded-full bg-purple-600 p-2 text-white transition-colors hover:bg-purple-700"
            >
              <ChevronUp className="h-5 w-5" />
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Expanded view */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="p-6 space-y-5">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-purple-600">Live Order Status</p>
                  <h3 className="font-display text-xl font-bold text-gray-900 mt-1">{booking.salon_name}</h3>
                  <p className="text-sm text-gray-600">{booking.service_name}</p>
                </div>
                <button
                  onClick={() => setExpanded(false)}
                  className="rounded-full bg-gray-100 p-1.5 text-gray-600 transition-colors hover:bg-gray-200"
                >
                  <ChevronDown className="h-5 w-5" />
                </button>
              </div>

              {/* Animated barber */}
              <div className="rounded-2xl bg-gradient-to-br from-purple-50 to-purple-100 p-6 flex flex-col items-center justify-center min-h-40">
                <BarberAnimation />
                <motion.p
                  animate={{ opacity: [0.6, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="mt-4 text-sm font-medium text-purple-700 text-center"
                >
                  Stylist is working on another customer...
                </motion.p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 p-4 text-center"
                >
                  <Users className="h-5 w-5 text-blue-600 mx-auto mb-1" />
                  <p className="font-display text-2xl font-bold text-blue-900">#{position}</p>
                  <p className="text-xs text-blue-700 font-medium">Your Position</p>
                </motion.div>

                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="rounded-2xl bg-gradient-to-br from-orange-50 to-orange-100 p-4 text-center"
                >
                  <Clock className="h-5 w-5 text-orange-600 mx-auto mb-1" />
                  <p className="font-display text-2xl font-bold text-orange-900">~{waitTime}m</p>
                  <p className="text-xs text-orange-700 font-medium">Wait Time</p>
                </motion.div>
              </div>

              {/* Progress bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-medium text-gray-600">
                  <span>Progress</span>
                  <span>{Math.max(0, 100 - position * 10)}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(0, 100 - position * 10)}%` }}
                    transition={{ duration: 0.5 }}
                    className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"
                  />
                </div>
              </div>

              {/* Info message */}
              <motion.div
                animate={{ opacity: [0.7, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="rounded-xl bg-purple-50 border border-purple-200 p-3 text-sm text-purple-700"
              >
                💡 We'll notify you when you're next!
              </motion.div>

              {/* Close button */}
              <button
                onClick={onClose}
                className="w-full rounded-xl bg-gray-100 p-3 font-medium text-gray-700 transition-colors hover:bg-gray-200"
              >
                Done for now
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapse/Close when compact */}
      {!expanded && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onClose}
          className="absolute top-2 right-2 rounded-full bg-red-500/90 p-1 text-white opacity-0 transition-opacity hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </motion.button>
      )}
    </motion.div>
  );
}


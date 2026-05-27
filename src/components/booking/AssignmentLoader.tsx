import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Clock, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
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
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl bg-red-50 border-2 border-red-200 p-6 sm:p-8"
      >
        <div className="flex items-start gap-4">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="mt-1"
          >
            <AlertCircle className="w-6 h-6 text-red-500" />
          </motion.div>
          <div>
            <h3 className="font-semibold text-red-900 mb-2">Unable to Find Stylist</h3>
            <p className="text-sm text-red-700">{error}</p>
            <p className="text-xs text-red-600 mt-3">
              Try selecting fewer services or choosing a different date/time
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 p-6 sm:p-8"
      >
        <div className="text-center space-y-6">
          {/* Shimmer Header */}
          <h3 className="text-lg sm:text-xl font-bold text-gray-800">
            Finding Best Stylist...
          </h3>

          {/* Animated Barber Icon with Shimmer */}
          <div className="flex justify-center">
            <motion.div
              animate={{ scale: [1, 1.05, 1], opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="relative"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-full blur-xl opacity-50 animate-pulse" />
              <div className="relative w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                <User className="w-10 h-10 text-white" />
              </div>
            </motion.div>
          </div>

          {/* Loading Dots */}
          <div className="flex justify-center gap-2">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, delay: i * 0.2, repeat: Infinity }}
                className="w-2 h-2 bg-blue-500 rounded-full"
              />
            ))}
          </div>

          <p className="text-sm text-gray-600">
            Analyzing availability and matching your preferences...
          </p>
        </div>
      </motion.div>
    );
  }

  if (!displayAssignment || !assignmentResult) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      className="rounded-2xl bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 border-2 border-green-200 p-6 sm:p-8 shadow-lg"
    >
      <div className="space-y-6">
        {/* Success Header */}
        <div className="flex items-center gap-3">
          <motion.div
            initial={{ rotate: -180, scale: 0 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </motion.div>
          <h3 className="text-lg sm:text-xl font-bold text-gray-900">
            Best Match Found!
          </h3>
        </div>

        {/* Assigned Barber Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-xl p-4 border border-green-100 shadow-sm"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Assigned Stylist
              </p>
              <h4 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">
                {assignmentResult.barberName}
              </h4>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                {/* Estimated Wait */}
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                  className="bg-orange-50 rounded-lg p-3 border border-orange-100"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-orange-600" />
                    <span className="text-xs font-semibold text-orange-700">
                      Est. Wait
                    </span>
                  </div>
                  <p className="text-lg font-bold text-orange-900">
                    {assignmentResult.estimatedWait} min
                  </p>
                </motion.div>

                {/* Completion Time */}
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                  className="bg-emerald-50 rounded-lg p-3 border border-emerald-100"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-semibold text-emerald-700">
                      Ready By
                    </span>
                  </div>
                  <p className="text-lg font-bold text-emerald-900">
                    {assignmentResult.completionTime}
                  </p>
                </motion.div>
              </div>
            </div>

            {/* Stylist Avatar */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: "spring" }}
              className="w-16 h-16 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg"
            >
              <User className="w-8 h-8 text-white" />
            </motion.div>
          </div>
        </motion.div>

        {/* Assignment Reason */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-lg p-3 border border-gray-200 text-center"
        >
          <p className="text-xs text-gray-600">
            💡 <span className="font-medium text-gray-700">{assignmentResult.reason}</span>
          </p>
        </motion.div>

        {/* Stylist Override Section - Only show if multiple barbers available */}
        {multipleBarbers && (
          <div className="border-t border-gray-200 pt-4">
            <button
              onClick={() => setShowSelector(!showSelector)}
              className="w-full flex items-center justify-between px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition font-medium text-gray-700"
            >
              <span>Prefer another stylist?</span>
              {showSelector ? (
                <ChevronUp size={18} />
              ) : (
                <ChevronDown size={18} />
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

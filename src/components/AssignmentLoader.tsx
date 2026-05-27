import { motion, AnimatePresence } from "framer-motion";
import { User, Clock, AlertCircle, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import type { BarberAssignmentResult } from "@/hooks/useSmartBarberAssignment";
import type { BarberScore } from "@/hooks/useSmartBarberAssignment";
import { BarberSelector } from "./BarberSelector";

interface AssignmentLoaderProps {
  isLoading: boolean;
  assignmentResult?: BarberAssignmentResult;
  error?: string;
  onRetry?: () => void;
  allBarbers?: BarberScore[];
  onBarberChange?: (barber: BarberScore) => void;
}

export function AssignmentLoader({
  isLoading,
  assignmentResult,
  error,
  onRetry,
  allBarbers = [],
  onBarberChange,
}: AssignmentLoaderProps) {
  const [showSelector, setShowSelector] = useState(false);

  // Only show "Choose Stylist" button if multiple barbers are available
  const multipleBarbers = allBarbers.length > 1;
  return (
    <div className="w-full rounded-lg p-6">
      <AnimatePresence mode="wait">
        {/* LOADING STATE */}
        {isLoading && !assignmentResult && !error && (
          <motion.div
            key="loading"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="text-center space-y-4"
          >
            <div className="flex justify-center">
              <motion.div
                animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <User size={48} className="text-purple-600" />
              </motion.div>
            </div>

            <p className="text-lg font-semibold text-gray-800">
              Finding Best Stylist...
            </p>

            <motion.div className="flex justify-center gap-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{ y: [0, -8, 0] }}
                  transition={{
                    duration: 1,
                    delay: i * 0.2,
                    repeat: Infinity,
                  }}
                  className="w-2 h-2 bg-purple-600 rounded-full"
                />
              ))}
            </motion.div>

            <p className="text-sm text-gray-500">
              Please wait while we find the fastest available stylist
            </p>
          </motion.div>
        )}

        {/* SUCCESS STATE */}
        {!isLoading && assignmentResult && !error && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4 }}
            className="bg-green-50 border-2 border-green-200 rounded-lg p-6 space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-200 rounded-full flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <p className="text-lg font-bold text-green-700">
                Stylist Assigned!
              </p>
            </div>

            <div className="bg-white rounded-lg p-4 space-y-3">
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {assignmentResult.barberName}
                </p>
              </div>

              <div className="flex items-center gap-2 text-gray-700">
                <Clock size={18} className="text-purple-600" />
                <span className="font-medium">
                  Est. Wait: {assignmentResult.estimatedWait} min
                </span>
              </div>

              <div className="flex items-center gap-2 text-gray-700">
                <Clock size={18} className="text-purple-600" />
                <span className="font-medium">
                  Ready by: {assignmentResult.completionTime}
                </span>
              </div>

              <p className="text-sm text-gray-600 italic">
                💡 {assignmentResult.reason}
              </p>
            </div>

            {/* Stylist Override Section */}
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

            <p className="text-sm text-gray-600 text-center">
              Proceed to next step to choose your time slot
            </p>
          </motion.div>
        )}
              </div>

              <div className="flex items-center gap-2 text-gray-700">
                <Clock size={18} className="text-purple-600" />
                <span className="font-medium">
                  Est. Wait: {assignmentResult.estimatedWait} min
                </span>
              </div>

              <div className="flex items-center gap-2 text-gray-700">
                <Clock size={18} className="text-purple-600" />
                <span className="font-medium">
                  Ready by: {assignmentResult.completionTime}
                </span>
              </div>

              <p className="text-sm text-gray-600 italic">
                💡 {assignmentResult.reason}
              </p>
            </div>

            <p className="text-sm text-gray-600 text-center">
              Proceed to next step to choose your time slot
            </p>
          </motion.div>
        )}

        {/* ERROR STATE */}
        {!isLoading && error && !assignmentResult && (
          <motion.div
            key="error"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4 }}
            className="bg-red-50 border-2 border-red-200 rounded-lg p-6 space-y-4"
          >
            <div className="flex items-center gap-3">
              <AlertCircle size={24} className="text-red-600" />
              <p className="text-lg font-bold text-red-700">
                Unable to Find Stylist
              </p>
            </div>

            <div className="bg-white rounded-lg p-4">
              <p className="text-gray-700 text-sm mb-3">{error}</p>
              <div className="space-y-2 text-sm text-gray-600">
                <p>💡 You can:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Retry to find an available stylist</li>
                  <li>Select different services</li>
                  <li>Choose a different date or time</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-3">
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="flex-1 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition"
                >
                  <RotateCcw size={18} />
                  Try Again
                </button>
              )}
              <p className="text-xs text-gray-500 flex items-center">
                Still having issues? Try refreshing the page.
              </p>
            </div>
          </motion.div>
        )}

        {/* FALLBACK: Show loading if nothing else matches (graceful degradation) */}
        {isLoading === false &&
          !assignmentResult &&
          !error && (
            <motion.div
              key="waiting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 text-center"
            >
              <p className="text-blue-700 font-medium">
                Finding available stylist...
              </p>
            </motion.div>
          )}
      </AnimatePresence>
    </div>
  );
}

import { motion } from "framer-motion";
import { Clock, MapPin, User, DollarSign, AlertCircle } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { BarberAssignmentResult } from "@/services/bookingEngine";

interface BookingSummaryProps {
  salonName: string;
  selectedServices: Tables<"services">[];
  assignedBarber?: BarberAssignmentResult | null;
  estimatedWait?: number;
  queuePosition?: number;
  isLoading?: boolean;
  address?: string;
  salonImage?: string;
}

export function BookingSummary({
  salonName,
  selectedServices,
  assignedBarber,
  estimatedWait = 0,
  queuePosition,
  isLoading = false,
  address,
  salonImage,
}: BookingSummaryProps) {
  const totalDuration = selectedServices.reduce(
    (sum, s) => sum + (s.duration || 30),
    0
  );
  const totalPrice = selectedServices.reduce(
    (sum, s) => sum + (s.price || 0),
    0
  );

  const formatMinutesAsTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="sticky bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg"
    >
      <div className="max-w-6xl mx-auto p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Booking Summary</h3>
          {isLoading && (
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent" />
              <span className="text-sm text-gray-600">Calculating...</span>
            </div>
          )}
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Salon Info */}
          <motion.div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
              Salon
            </p>
            <p className="font-semibold text-gray-900">{salonName}</p>
            {address && (
              <div className="flex items-start gap-1 text-sm text-gray-600">
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{address}</span>
              </div>
            )}
          </motion.div>

          {/* Services Info */}
          <motion.div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
              Services ({selectedServices.length})
            </p>
            <div className="space-y-1">
              {selectedServices.slice(0, 2).map((service) => (
                <p key={service.id} className="text-sm text-gray-700">
                  ✓ {service.name}
                </p>
              ))}
              {selectedServices.length > 2 && (
                <p className="text-sm text-gray-500">
                  +{selectedServices.length - 2} more
                </p>
              )}
            </div>
          </motion.div>

          {/* Duration & Price */}
          <motion.div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
                Duration
              </p>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <span className="font-bold text-gray-900">
                  {formatMinutesAsTime(totalDuration)}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
                Total Price
              </p>
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-600" />
                <span className="font-bold text-gray-900">
                  ₹{totalPrice.toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          </motion.div>

          {/* Wait Time & Barber */}
          <motion.div className="space-y-3">
            {assignedBarber ? (
              <>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-1">
                    Assigned Barber
                  </p>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-purple-600" />
                    <span className="font-semibold text-gray-900">
                      {assignedBarber.barberName}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-1">
                    Est. Wait Time
                  </p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-orange-600">
                      {formatMinutesAsTime(assignedBarber.estimatedWaitMinutes)}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-1">
                  Est. Wait Time
                </p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-orange-600">
                    {formatMinutesAsTime(estimatedWait)}
                  </span>
                </div>
              </div>
            )}

            {queuePosition && (
              <div>
                <p className="text-xs text-gray-500">
                  Queue Position: #{queuePosition}
                </p>
              </div>
            )}
          </motion.div>
        </div>

        {/* Assignment Info */}
        {assignedBarber && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm"
          >
            <div className="flex gap-2">
              <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-blue-700">
                <span className="font-semibold">Smart Assignment: </span>
                {assignedBarber.assignmentReason}
              </p>
            </div>
          </motion.div>
        )}

        {/* Completion Time */}
        {assignedBarber && (
          <motion.div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
            <p className="text-green-700">
              <span className="font-semibold">Expected Completion: </span>
              {assignedBarber.estimatedCompletionTime}
            </p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

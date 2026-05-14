import { motion, AnimatePresence } from "framer-motion";
import { X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CancelConfirmationProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
  salonName: string;
  serviceName: string;
}

export function CancelConfirmation({
  open,
  onClose,
  onConfirm,
  isLoading,
  salonName,
  serviceName,
}: CancelConfirmationProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/45"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-red-100 p-2.5">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-bold text-gray-900">Cancel Booking?</h3>
                    <p className="text-sm text-gray-600">This action cannot be undone.</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="text-gray-400 transition-colors hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Details */}
              <div className="space-y-3 border-t border-gray-100 pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Salon</span>
                  <span className="font-semibold text-gray-900">{salonName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Service</span>
                  <span className="font-semibold text-gray-900">{serviceName}</span>
                </div>
              </div>

              {/* Warning message */}
              <motion.div
                animate={{ opacity: [0.6, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
              >
                ⚠️ You'll lose your queue position and booking slot.
              </motion.div>

              {/* Actions */}
              <div className="flex gap-3 border-t border-gray-100 pt-4">
                <Button
                  variant="outline"
                  className="flex-1 text-gray-700"
                  onClick={onClose}
                  disabled={isLoading}
                >
                  Keep Booking
                </Button>
                <Button
                  className="flex-1 bg-red-600 hover:bg-red-700"
                  onClick={onConfirm}
                  disabled={isLoading}
                >
                  {isLoading ? "Cancelling..." : "Cancel It"}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}


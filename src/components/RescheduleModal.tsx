import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Calendar, Clock, ChevronDown, ChevronUp, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RescheduleModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (newDate: string, newTime: string) => void;
  booking?: {
    salon_name?: string;
    service_name?: string;
    current_date?: string;
    current_time?: string;
  } | null;
  isLoading?: boolean;
}

export function RescheduleModal({
  open,
  onClose,
  onConfirm,
  booking,
  isLoading,
}: RescheduleModalProps) {
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [activePicker, setActivePicker] = useState<"date" | "time" | null>("date");

  if (!booking) return null;

  const today = new Date();

  useEffect(() => {
    if (!open) return;
    setSelectedDate("");
    setSelectedTime("");
    setActivePicker("date");
  }, [open]);

  // Generate next 30 days
  const generateDates = () => {
    const dates = [];
    for (let i = 1; i <= 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      dates.push(date.toISOString().split("T")[0]);
    }
    return dates;
  };

  const availableDates = generateDates();

  // Time slots
  const timeSlots = [
    "09:00",
    "10:00",
    "11:00",
    "12:00",
    "14:00",
    "15:00",
    "16:00",
    "17:00",
    "18:00",
  ];

  const handleConfirm = () => {
    if (!selectedDate || !selectedTime) {
      return;
    }
    onConfirm(selectedDate, selectedTime);
  };

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    setSelectedTime("");
    setActivePicker("time");
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setActivePicker(null);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(`${dateStr}T00:00:00`);
    return date.toLocaleDateString("en-IN", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

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
            className="fixed inset-x-4 top-1/2 z-50 w-auto max-w-md -translate-x-1/2 -translate-y-1/2 left-1/2 max-h-[85vh] overflow-y-auto rounded-3xl bg-white shadow-2xl"
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-bold text-gray-900">Reschedule</h3>
                <p className="text-xs text-gray-600 mt-0.5">{booking.salon_name}</p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 transition-colors hover:text-gray-600 flex-shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Current booking info */}
              {booking.current_date && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg bg-gray-50 p-3 space-y-1"
                >
                  <p className="text-xs text-gray-600 font-medium uppercase tracking-wide">Current</p>
                  <div className="flex items-center gap-2 text-xs text-gray-700">
                    <Calendar className="h-3 w-3 text-purple-600" />
                    <span>{booking.current_date}</span>
                  </div>
                  {booking.current_time && (
                    <div className="flex items-center gap-2 text-xs text-gray-700">
                      <Clock className="h-3 w-3 text-purple-600" />
                      <span>{booking.current_time}</span>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Date step card */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="rounded-xl border border-purple-200 bg-purple-50/60"
              >
                <button
                  type="button"
                  onClick={() => setActivePicker(activePicker === "date" ? null : "date")}
                  className="flex w-full items-center justify-between gap-2 p-3"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-purple-900">
                    <Calendar className="h-4 w-4 text-purple-600" />
                    {selectedDate ? formatDate(selectedDate) : "Choose date"}
                  </span>
                  <span className="text-purple-700">
                    {activePicker === "date" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </span>
                </button>

                <AnimatePresence initial={false}>
                  {activePicker === "date" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.18 }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-3 gap-2 p-3 pt-0 max-h-40 overflow-y-auto">
                        {availableDates.map((date) => (
                          <motion.button
                            key={date}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleDateSelect(date)}
                            className={`rounded-lg p-2 text-xs font-medium transition-all ${
                              selectedDate === date
                                ? "bg-purple-600 text-white shadow-lg"
                                : "bg-white text-gray-700 hover:bg-gray-100"
                            }`}
                          >
                            {formatDate(date)}
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Time step card */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className={`rounded-xl border ${selectedDate ? "border-blue-200 bg-blue-50/60" : "border-gray-200 bg-gray-50"}`}
              >
                <button
                  type="button"
                  onClick={() => selectedDate && setActivePicker(activePicker === "time" ? null : "time")}
                  disabled={!selectedDate}
                  className="flex w-full items-center justify-between gap-2 p-3 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <Clock className="h-4 w-4 text-blue-600" />
                    {selectedTime || (selectedDate ? "Choose time" : "Select date first")}
                  </span>
                  <span className="text-blue-700">
                    {activePicker === "time" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </span>
                </button>

                <AnimatePresence initial={false}>
                  {activePicker === "time" && selectedDate && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.18 }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-3 gap-2 p-3 pt-0">
                        {timeSlots.map((time) => (
                          <motion.button
                            key={time}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleTimeSelect(time)}
                            className={`rounded-lg p-2 text-xs font-medium transition-all ${
                              selectedTime === time
                                ? "bg-blue-600 text-white shadow-lg"
                                : "bg-white text-gray-700 hover:bg-gray-100"
                            }`}
                          >
                            {time}
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Selection summary */}
              {selectedDate && selectedTime && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg bg-emerald-50 border border-emerald-200 p-3"
                >
                  <p className="flex items-center gap-2 text-xs text-emerald-900">
                    <Check className="h-3.5 w-3.5" />
                    <span><span className="font-semibold">New:</span> {formatDate(selectedDate)} at {selectedTime}</span>
                  </p>
                </motion.div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  className="flex-1 h-9 text-xs text-gray-700"
                  onClick={onClose}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 h-9 bg-purple-600 hover:bg-purple-700 text-xs"
                  onClick={handleConfirm}
                  disabled={isLoading || !selectedDate || !selectedTime}
                >
                  {isLoading ? "..." : "Confirm"}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

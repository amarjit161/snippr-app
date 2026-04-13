import { toast } from "sonner";

interface SupabaseError {
  code?: string;
  message?: string;
  details?: string;
  status?: number;
}

export const useErrorHandler = () => {
  const handleError = (error: SupabaseError | null, context: string) => {
    if (!error) return;

    console.error(`[${context}]`, error);

    switch (error.code) {
      case "23505":
        toast.error("⏱️ Just missed it! That slot was just booked. Pick another time.");
        break;
      case "23503":
        toast.error("❌ Invalid reference. Please refresh and try again.");
        break;
      case "42501":
      case "PGRST301":
        toast.error("🔒 Permission denied. Please log in again.");
        break;
      case "PGRST116":
        toast.error("⚠️ Data error. Please refresh the page.");
        break;
      case "400":
        toast.error("❌ Bad request. Please check your details.");
        break;
      case "409":
        toast.error("⏱️ Conflict! This slot was just taken. Pick another.");
        break;
      default:
        if (error.message?.includes("timeout") || error.message?.includes("Timeout")) {
          toast.error("🌐 Connection slow. Please check your internet and retry.");
        } else if (error.message?.includes("JWT") || error.message?.includes("token")) {
          toast.error("🔐 Session expired. Please log in again.");
        } else {
          toast.error("Something went wrong. Please try again.");
        }
    }
  };

  const handleBookingError = (error: SupabaseError | null, refreshSlots?: () => void) => {
    if (!error) return;

    if (error.code === "23505" || error.code === "409" || error.status === 409) {
      toast.error("⏱️ Just missed it! Someone booked this slot. Pick another time.");
      refreshSlots?.();
      return;
    }

    handleError(error, "BOOKING");
  };

  return { handleError, handleBookingError };
};

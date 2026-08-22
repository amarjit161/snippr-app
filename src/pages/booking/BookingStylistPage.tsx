import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { BookingPageShell } from "@/components/booking/BookingPageShell";
import { AssignmentLoader } from "@/components/booking/AssignmentLoader";
import { useBookingDraft } from "@/contexts/BookingDraftContext";

export default function BookingStylistPage() {
  const navigate = useNavigate();
  const {
    selectedServices,
    assignmentResult,
    isAssigning,
    assignmentError,
    allBarbers,
    triggerAssignment,
    handleBarberChange,
    loadingSalon,
  } = useBookingDraft();

  useEffect(() => {
    if (selectedServices.length === 0) {
      navigate("/booking/service");
      return;
    }
    triggerAssignment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedServices.length]);

  if (loadingSalon) return null;

  return (
    <BookingPageShell
      stepNumber={2}
      title="Find Your Stylist"
      subtitle="We'll automatically assign the best available stylist"
      onBack={() => navigate("/booking/service")}
      onNext={() => {
        if (!assignmentResult) {
          toast.error("Please wait for stylist assignment to complete...");
          return;
        }
        navigate("/booking/date");
      }}
      nextDisabled={isAssigning || !assignmentResult}
    >
      <AssignmentLoader
        isLoading={isAssigning}
        assignmentResult={assignmentResult}
        error={assignmentError}
        allBarbers={allBarbers}
        onBarberChange={handleBarberChange}
      />
    </BookingPageShell>
  );
}

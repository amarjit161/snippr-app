import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BookingPageShell } from "@/components/booking/BookingPageShell";
import { AssignmentLoader } from "@/components/booking/AssignmentLoader";
import { useBookingDraft } from "@/contexts/BookingDraftContext";

const getSalonImageSrc = (imageUrl: string | null | undefined) => {
  if (!imageUrl) return "/default-salon.jpg";
  if (imageUrl.startsWith("http") || imageUrl.startsWith("/")) return imageUrl;
  const { data } = supabase.storage.from("salon-images").getPublicUrl(imageUrl);
  return data.publicUrl || "/default-salon.jpg";
};

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
    salon,
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
      title="Choose your stylist"
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
      {salon && (
        <div className="mb-5 flex items-center gap-3">
          <img
            src={getSalonImageSrc(salon.image_url)}
            alt=""
            className="h-11 w-11 shrink-0 rounded-xl border border-border object-cover"
          />
          <p className="truncate text-sm font-semibold text-foreground">{salon.name}</p>
        </div>
      )}

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

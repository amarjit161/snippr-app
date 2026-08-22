import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { BookingPageShell } from "@/components/booking/BookingPageShell";
import { ServiceSelector } from "@/components/booking/ServiceSelector";
import { useBookingDraft } from "@/contexts/BookingDraftContext";

export default function BookingServicePage() {
  const navigate = useNavigate();
  const { services, selectedServices, setSelectedServices, loadingSalon, salon, exitFlow } = useBookingDraft();

  if (loadingSalon) return null;

  return (
    <BookingPageShell
      stepNumber={1}
      title="Select Services"
      subtitle="Choose one or more services for your visit"
      onBack={() => (salon ? navigate(`/salon/${salon.id}`) : exitFlow())}
      onNext={() => {
        if (selectedServices.length === 0) {
          toast.error("Please select at least one service");
          return;
        }
        navigate("/booking/stylist");
      }}
    >
      <ServiceSelector services={services} selectedServices={selectedServices} onServicesChange={setSelectedServices} isLoading={false} />
    </BookingPageShell>
  );
}

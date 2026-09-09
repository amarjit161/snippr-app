import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BookingPageShell } from "@/components/booking/BookingPageShell";
import { ServiceSelector } from "@/components/booking/ServiceSelector";
import { useBookingDraft } from "@/contexts/BookingDraftContext";

const getSalonImageSrc = (imageUrl: string | null | undefined) => {
  if (!imageUrl) return "/default-salon.jpg";
  if (imageUrl.startsWith("http") || imageUrl.startsWith("/")) return imageUrl;
  const { data } = supabase.storage.from("salon-images").getPublicUrl(imageUrl);
  return data.publicUrl || "/default-salon.jpg";
};

export default function BookingServicePage() {
  const navigate = useNavigate();
  const { services, selectedServices, setSelectedServices, loadingSalon, salon, exitFlow } = useBookingDraft();

  if (loadingSalon) return null;

  return (
    <BookingPageShell
      stepNumber={1}
      title="Choose your services"
      subtitle="Select one or more services for your visit"
      onBack={() => (salon ? navigate(`/salon/${salon.id}`) : exitFlow())}
      onNext={() => {
        if (selectedServices.length === 0) {
          toast.error("Please select at least one service");
          return;
        }
        navigate("/booking/stylist");
      }}
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

      <ServiceSelector services={services} selectedServices={selectedServices} onServicesChange={setSelectedServices} isLoading={false} />
    </BookingPageShell>
  );
}

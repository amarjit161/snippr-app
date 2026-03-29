import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Clock, DollarSign, Check, Navigation, UserCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useGeolocation, estimateTravelMinutes } from "@/hooks/useGeolocation";
import type { Tables } from "@/integrations/supabase/types";

import salon1 from "@/assets/salon-1.jpg";
import salon2 from "@/assets/salon-2.jpg";
import salon3 from "@/assets/salon-3.jpg";
import salon4 from "@/assets/salon-4.jpg";

const salonImages: Record<string, string> = {
  "/salon-1": salon1, "/salon-2": salon2, "/salon-3": salon3, "/salon-4": salon4,
};

interface SalonDetailProps {
  salon: Tables<"salons">;
  onBack: () => void;
  onJoined: () => void;
}

const SalonDetail = ({ salon, onBack, onJoined }: SalonDetailProps) => {
  const { user } = useAuth();
  const { location } = useGeolocation();
  const [services, setServices] = useState<Tables<"services">[]>([]);
  const [barbers, setBarbers] = useState<any[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedBarber, setSelectedBarber] = useState<string | null>(null);
  
  const [queueCount, setQueueCount] = useState(0);
  const [totalQueueWait, setTotalQueueWait] = useState(0);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const [{ data: svcData }, { data: bbrData }, { data: qData }] = await Promise.all([
        supabase.from("services").select("*").eq("salon_id", salon.id),
        supabase.from("barbers").select("*").eq("salon_id", salon.id),
        supabase.from("queue").select("*, services(duration)").eq("salon_id", salon.id).eq("status", "waiting"),
      ]);
      if (svcData) setServices(svcData);
      if (bbrData) setBarbers(bbrData);
      
      const q = qData ?? [];
      setQueueCount(q.length);
      setTotalQueueWait(q.reduce((s, e: any) => s + (e.services?.duration ?? 20), 0));
    };
    fetch();
  }, [salon.id]);

  const toggleService = (id: string) => {
    setSelectedServices(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const travelMin = location ? estimateTravelMinutes(location.lat, location.lng, salon.lat, salon.lng) : 10;
  const arriveIn = Math.max(0, totalQueueWait - travelMin);

  const handleJoinQueue = async () => {
    if (!user || selectedServices.length === 0) return;
    setJoining(true);

    const { data: existing } = await supabase
      .from("queue").select("id").eq("user_id", user.id).eq("salon_id", salon.id).eq("status", "waiting").maybeSingle();

    if (existing) {
      toast.error("You're already in the queue at this salon!");
      setJoining(false);
      return;
    }

    const rpcParams: any = {
      p_salon_id: salon.id,
      p_user_id: user.id,
      p_service_ids: selectedServices,
    };
    if (selectedBarber) {
      rpcParams.p_barber_id = selectedBarber;
    }

    const { error } = await supabase.rpc("join_queue", rpcParams);

    if (error) {
      console.error(error);
      toast.error("Failed to join queue. Did you run the migration script?");
    } else {
      toast.success(`You're #${queueCount + 1} in queue!`, {
        description: `Leave in ~${arriveIn} min for perfect timing`,
      });
      onJoined();
    }
    setJoining(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      className="space-y-6"
    >
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to salons
      </button>

      <div className="overflow-hidden rounded-lg shadow-elevation-2">
        <img src={salonImages[salon.image_url ?? ""] ?? salon1} alt={salon.name} className="h-56 w-full object-cover" />
      </div>

      <div>
        <h2 className="font-display text-2xl font-bold text-foreground">{salon.name}</h2>
        <p className="text-muted-foreground">{salon.location}</p>
        <div className="flex items-center gap-2 mt-2">
          <Badge className="bg-primary/10 text-primary">{queueCount} in queue</Badge>
          <Badge className="bg-secondary text-muted-foreground">
            <Navigation className="h-3 w-3 mr-1" /> {travelMin} min away
          </Badge>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="font-display text-lg font-semibold text-foreground">Select Services (Multiple possible)</h3>
        <div className="grid gap-3">
          {services.map((service) => {
            const isSelected = selectedServices.includes(service.id);
            return (
              <button
                key={service.id}
                onClick={() => toggleService(service.id)}
                className={`flex items-center justify-between rounded-lg border-2 p-4 text-left transition-all ${
                  isSelected ? "border-primary bg-primary/5 shadow-elevation-1" : "border-border hover:border-primary/30"
                }`}
              >
                <div>
                  <p className="font-medium text-foreground">{service.name}</p>
                  <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {service.duration} min</span>
                    <span className="flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" /> ${service.price}</span>
                  </div>
                </div>
                {isSelected && (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                    <Check className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {barbers.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-border">
          <h3 className="font-display text-lg font-semibold text-foreground">Select a Barber (Optional)</h3>
          <div className="flex flex-wrap gap-2">
            <button
               onClick={() => setSelectedBarber(null)}
               className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-colors ${
                 selectedBarber === null ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/50"
               }`}
            >
              Any Available
            </button>
            {barbers.map((barber) => (
              <button
                 key={barber.id}
                 onClick={() => setSelectedBarber(barber.id)}
                 className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-colors ${
                   selectedBarber === barber.id ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/50"
                 }`}
              >
                <UserCircle className="h-4 w-4" />
                {barber.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedServices.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg bg-secondary p-4 space-y-2 mt-6">
          <p className="text-sm text-muted-foreground">Estimated wait</p>
          <p className="font-display text-xl font-bold text-foreground">~{totalQueueWait} min</p>
          <p className="text-sm text-muted-foreground">
            🚶 Travel: {travelMin} min • 💡 Leave in ~{arriveIn} min for perfect timing
          </p>
        </motion.div>
      )}

      <Button onClick={handleJoinQueue} disabled={selectedServices.length === 0 || joining || salon.status !== "open"} className="w-full mt-4" size="lg">
        {joining ? "Joining…" : "Join Queue"}
      </Button>
    </motion.div>
  );
};

export default SalonDetail;

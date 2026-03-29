import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Clock, DollarSign, Check, Navigation, Calendar, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const TIME_SLOTS = ["10:00 AM","11:00 AM","12:00 PM","01:00 PM","02:00 PM","03:00 PM","04:00 PM","05:00 PM","06:00 PM","07:00 PM","08:00 PM"];

const SalonDetail = ({ salon, onBack, onJoined }: SalonDetailProps) => {
  const { user } = useAuth();
  const { location } = useGeolocation();
  const [services, setServices] = useState<Tables<"services">[]>([]);
  const [selectedService, setSelectedService] = useState<Tables<"services"> | null>(null);
  
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00 AM");
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    supabase.from("services").select("*").eq("salon_id", salon.id)
      .then(({ data }) => setServices(data || []));
  }, [salon.id]);

  const travelMin = location && salon.lat && salon.lng 
    ? estimateTravelMinutes(location.lat, location.lng, salon.lat, salon.lng) 
    : 10;

  const handleBook = async () => {
    if (!user || !selectedService || !date || !time) {
       toast.error("Please fill all booking details");
       return;
    }
    setBooking(true);

    const { error } = await supabase.from("bookings").insert({
      user_id: user.id,
      email: user.email || "user@example.com",
      service: selectedService.name,
      booking_date: date,
      booking_time: time,
      salon_id: salon.id 
    } as any);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Booking request sent successfully!");
      onJoined();
    }
    setBooking(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="overflow-hidden rounded-3xl bg-white shadow-[0_4px_24px_rgb(0,0,0,0.04)] ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800"
    >
      <div className="relative h-64 w-full bg-zinc-100 dark:bg-zinc-800">
        <img src={salonImages[salon.image_url ?? ""] ?? salon1} alt={salon.name} className="h-full w-full object-cover" />
        <button 
          onClick={onBack} 
          className="absolute left-6 top-6 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur-sm transition-transform hover:scale-105 dark:bg-zinc-900/90"
        >
          <ArrowLeft className="h-5 w-5 text-zinc-900 dark:text-zinc-50" />
        </button>
      </div>

      <div className="p-6 sm:p-10 space-y-10">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{salon.name}</h1>
          <p className="mt-3 text-zinc-500 flex items-center gap-2 dark:text-zinc-400 font-medium">
            <Navigation className="h-4 w-4" /> {travelMin} min away • {salon.location}
          </p>
        </div>

        <div className="space-y-4">
          <h3 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">1. Select a Service</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {services.map((svc) => (
              <button
                key={svc.id}
                onClick={() => setSelectedService(svc)}
                className={`flex text-left flex-col rounded-2xl border p-5 transition-all outline-none ${
                  selectedService?.id === svc.id 
                    ? "border-zinc-900 bg-zinc-50 ring-1 ring-zinc-900 dark:border-zinc-50 dark:bg-zinc-800/50 dark:ring-zinc-50 shadow-sm" 
                    : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                }`}
              >
                <div className="flex justify-between items-start w-full">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-50">{svc.name}</span>
                  {selectedService?.id === svc.id && <Check className="h-5 w-5 text-zinc-900 dark:text-zinc-50" />}
                </div>
                <div className="mt-3 flex items-center gap-4 text-sm font-medium text-zinc-500">
                  <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> {svc.duration}m</span>
                  <span className="flex items-center gap-1.5"><DollarSign className="h-4 w-4" /> ${svc.price}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence>
          {selectedService && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-5 pt-2">
              <h3 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">2. Choose Date & Time</h3>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <Input 
                      type="date"
                      required
                      min={new Date().toISOString().split("T")[0]}
                      value={date}
                      onChange={e => setDate(e.target.value)}
                      className="h-14 rounded-2xl border-zinc-200 bg-zinc-50 pl-11 font-medium transition-all focus:border-zinc-400 focus:ring-4 focus:ring-zinc-900/5 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600 dark:focus:ring-zinc-50/5"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Time</label>
                  <div className="relative">
                    <Clock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <select 
                      value={time} 
                      onChange={e => setTime(e.target.value)}
                      className="h-14 w-full rounded-2xl border border-zinc-200 bg-zinc-50 pl-11 pr-4 font-medium outline-none transition-all focus:border-zinc-400 focus:ring-4 focus:ring-zinc-900/5 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600 dark:focus:ring-zinc-50/5"
                    >
                      {TIME_SLOTS.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="pt-6">
                <Button 
                   onClick={handleBook} 
                   disabled={!date || booking} 
                   className="h-14 w-full rounded-2xl bg-zinc-900 text-base font-semibold tracking-wide text-white transition-all hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {booking ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : `Book ${selectedService.name} - $${selectedService.price}`}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default SalonDetail;

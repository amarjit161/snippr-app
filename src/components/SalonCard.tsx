import { Clock, MapPin, Star, Users } from "lucide-react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { cardFloat } from "@/lib/motion";

import salon1 from "@/assets/salon-1.jpg";
import salon2 from "@/assets/salon-2.jpg";
import salon3 from "@/assets/salon-3.jpg";
import salon4 from "@/assets/salon-4.jpg";

const salonImages: Record<string, string> = {
  "/salon-1": salon1,
  "/salon-2": salon2,
  "/salon-3": salon3,
  "/salon-4": salon4,
};

const getSalonImageSrc = (imageUrl: string | null) => {
  if (!imageUrl) {
    return "/default-salon.jpg";
  }

  if (salonImages[imageUrl]) {
    return salonImages[imageUrl];
  }

  if (imageUrl.startsWith("http") || imageUrl.startsWith("/")) {
    return imageUrl;
  }

  const { data } = supabase.storage.from("salon-images").getPublicUrl(imageUrl);
  return data.publicUrl || "/default-salon.jpg";
};

const isWithinOperatingHours = (openTime: string | null, closeTime: string | null): boolean => {
  if (!openTime || !closeTime) return true; // If no times set, assume always open
  
  try {
    const now = new Date();
    const currentTime = now.getHours() * 100 + now.getMinutes(); // Convert to HHMM format (e.g., 1430 for 2:30 PM)
    
    // Parse time - handle both "09:00" and "09:00:00" formats
    const openParts = openTime.split(":").map(Number);
    const closeParts = closeTime.split(":").map(Number);
    
    const [openHour, openMin] = [openParts[0], openParts[1] || 0];
    const [closeHour, closeMin] = [closeParts[0], closeParts[1] || 0];
    
    const openTimeNum = openHour * 100 + openMin;
    const closeTimeNum = closeHour * 100 + closeMin;
    
    // Handle case where closing time is next day (e.g., 9 AM to 11 PM)
    if (openTimeNum <= closeTimeNum) {
      return currentTime >= openTimeNum && currentTime <= closeTimeNum;
    } else {
      // Closing time is next day (e.g., 10 PM to 6 AM)
      return currentTime >= openTimeNum || currentTime <= closeTimeNum;
    }
  } catch (e) {
    console.error("TIME_PARSE_ERROR", openTime, closeTime, e);
    return true; // Assume open if parse fails
  }
};

interface SalonCardProps {
  salon: Tables<"salons"> & { queueCount: number; waitTime: number; distance?: number };
  index: number;
  onSelect: (salon: Tables<"salons">) => void;
}

const SalonCard = ({ salon, index, onSelect }: SalonCardProps) => {
  // Logic: If manually closed, always show closed. Otherwise check operating hours.
  const isManuallyClosed = salon.is_manual_closed;
  const isWithinHours = isWithinOperatingHours(salon.open_time, salon.close_time);
  const isOpen = !isManuallyClosed && isWithinHours;
  
  if (index === 0) {
    const now = new Date();
    const currentTimeNum = now.getHours() * 100 + now.getMinutes();
    console.log("SALON_CARD_LOGIC", {
      salonName: salon.name,
      isManuallyClosed,
      openTime: salon.open_time,
      closeTime: salon.close_time,
      isWithinHours,
      currentTime: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`,
      currentTimeNum,
      isOpen,
    });
  }

  return (
    <motion.div
      custom={index}
      initial="hidden"
      animate="visible"
      variants={cardFloat}
      className="group bg-white rounded-2xl overflow-hidden shadow-[0_20px_40px_rgba(99,14,212,0.06)] transition-all hover:-translate-y-1 cursor-pointer"
      onClick={() => onSelect(salon)}
    >
      <div className="relative h-56 overflow-hidden">
        <img
          src={getSalonImageSrc(salon.image_url)}
          alt={salon.name}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute top-4 right-4 flex gap-2">
          {isOpen ? (
            <span className="bg-[#6ffbbe] text-[#002113] px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm">
              Open
            </span>
          ) : (
            <span className="bg-[#e1e3e4] text-[#191c1d] px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm">
              Closed
            </span>
          )}
        </div>
        
        {isOpen && (
          <div className="absolute bottom-4 left-4">
            <span className="bg-black/40 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {salon.waitTime}m wait
            </span>
          </div>
        )}
      </div>

      <div className="p-6">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-headline font-bold text-xl text-[#191c1d] line-clamp-1">
            {salon.name}
          </h3>
          <div className="flex items-center gap-1 text-[#191c1d]">
            <Star className="text-[#630ed4] w-[18px] h-[18px] fill-[#630ed4]" />
            <span className="font-bold text-sm">{salon.rating || "4.8"}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[#4a4455] text-sm mb-6 whitespace-nowrap overflow-hidden text-ellipsis">
          {salon.distance !== undefined && (
            <>
              <span className="flex items-center gap-1 shrink-0">
                <MapPin className="w-[16px] h-[16px]" />
                {salon.distance.toFixed(1)} km
              </span>
              <span className="w-1 h-1 rounded-full bg-[#ccc3d8] shrink-0"></span>
            </>
          )}
          <span className="truncate">{salon.location || "Location not available"}</span>
        </div>

        <button 
          onClick={(e) => {
            e.stopPropagation();
            onSelect(salon);
          }}
          disabled={!isOpen}
          className="w-full text-white py-3 rounded-full font-bold text-sm tracking-wide shadow-lg hover:brightness-110 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: isOpen ? 'linear-gradient(to right, #630ed4, #7c3aed)' : '#7b7487' }}
        >
          {isOpen ? "Book a Snipp" : "Currently Closed"}
        </button>
      </div>
    </motion.div>
  );
};

export default SalonCard;


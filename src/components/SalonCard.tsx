import { Clock, MapPin, Star, Users } from "lucide-react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

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

interface SalonCardProps {
  salon: Tables<"salons"> & { queueCount: number; waitTime: number; distance?: number };
  index: number;
  onSelect: (salon: Tables<"salons">) => void;
}

const SalonCard = ({ salon, index, onSelect }: SalonCardProps) => {
  const isOpen = salon.status === "open";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.08 }}
      className="group cursor-pointer overflow-hidden rounded-2xl bg-white shadow-md transition hover:shadow-xl"
      onClick={() => onSelect(salon)}
    >
      <div className="relative h-48 overflow-hidden">
        <img
          src={getSalonImageSrc(salon.image_url)}
          alt={salon.name}
          loading={index === 0 ? undefined : "lazy"}
          width={640}
          height={512}
          className="h-48 w-full rounded-t-2xl object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <Badge
          className={`absolute top-3 right-3 ${
            isOpen
              ? "bg-success text-success-foreground"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {isOpen ? "Open" : "Closed"}
        </Badge>
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-lg font-bold text-card-foreground leading-tight">
            {salon.name}
          </h3>
          <span className="flex items-center gap-1 text-sm font-medium text-warning shrink-0">
            <Star className="h-4 w-4 fill-current" />
            {salon.rating}
          </span>
        </div>

        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          {salon.location} {salon.distance !== undefined ? `• ${salon.distance.toFixed(1)} km away` : ""}
        </p>

        {isOpen && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {salon.queueCount} in queue
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              ~{salon.waitTime} min
            </span>
          </div>
        )}

        <Button
          onClick={(e) => {
            e.stopPropagation();
            onSelect(salon);
          }}
          disabled={!isOpen}
          className="w-full mt-1"
          size="lg"
        >
          {isOpen ? "View & Join Queue" : "Currently Closed"}
        </Button>
      </div>
    </motion.div>
  );
};

export default SalonCard;

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Bell, Clock, MapPin, Navigation, Users, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useGeolocation, estimateTravelMinutes } from "@/hooks/useGeolocation";
import type { Tables } from "@/integrations/supabase/types";

const QueueTracker = () => {
  const { user } = useAuth();
  const { location } = useGeolocation();
  const [entry, setEntry] = useState<(Tables<"queue"> & { salons: Tables<"salons">; services: Tables<"services"> }) | null>(null);
  const [aheadCount, setAheadCount] = useState(0);
  const [totalWait, setTotalWait] = useState(0);
  const prevAhead = useRef<number | null>(null);

  const fetchMyQueue = async () => {
    if (!user) return;

    // Check for in_progress status too (service started)
    const { data } = await supabase
      .from("queue")
      .select("*, salons(*), services(*)")
      .eq("user_id", user.id)
      .in("status", ["waiting", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setEntry(data as any);

      if (data.status === "in_progress") {
        setAheadCount(0);
        setTotalWait(0);
        if (prevAhead.current !== -1) {
          toast.success("✂️ Your service has started!", { duration: 8000 });
          prevAhead.current = -1;
        }
        return;
      }

      const { data: aheadEntries } = await supabase
        .from("queue")
        .select("service_id, services(duration)")
        .eq("salon_id", data.salon_id)
        .in("status", ["waiting", "in_progress"])
        .lt("created_at", data.created_at);

      const ahead = aheadEntries?.length ?? 0;
      const wait = (aheadEntries ?? []).reduce(
        (sum, e: any) => sum + (e.services?.duration ?? 20), 0
      );
      
      setAheadCount(ahead);
      setTotalWait(wait);

      // Smart notifications based on position changes
      if (prevAhead.current !== null && prevAhead.current !== ahead) {
        if (ahead === 0) {
          toast.success("🎉 You're next! Get ready!", { duration: 10000 });
        } else if (ahead <= 2 && prevAhead.current > 2) {
          toast.info(`⏰ Your turn in ~${wait} minutes`, { duration: 6000 });
        } else if (ahead < prevAhead.current) {
          toast("Queue updated", { description: `You're now #${ahead + 1}` });
        }
      }
      prevAhead.current = ahead;
    } else {
      if (entry && prevAhead.current === -1) {
        toast.success("✅ Service completed! See you next time!", { duration: 6000 });
      }
      setEntry(null);
      prevAhead.current = null;
    }
  };

  useEffect(() => {
    fetchMyQueue();

    const channel = supabase
      .channel("queue-tracker-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "queue" }, () => {
        fetchMyQueue();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleCancel = async () => {
    if (!entry) return;
    await supabase.from("queue").delete().eq("id", entry.id);
    toast.info("Queue entry cancelled");
    setEntry(null);
    prevAhead.current = null;
  };

  if (!entry) return null;

  const salon = entry.salons;
  const service = entry.services;
  const isInProgress = entry.status === "in_progress";

  const travelMin = location
    ? estimateTravelMinutes(location.lat, location.lng, salon.lat, salon.lng)
    : 10;
  const leaveIn = Math.max(0, totalWait - travelMin);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-2xl bg-card border border-border shadow-elevation-3 p-5 space-y-4"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isInProgress ? "bg-success/10" : "bg-primary/10"}`}>
            <Bell className={`h-5 w-5 ${isInProgress ? "text-success" : "text-primary"}`} />
          </div>
          <div>
            <p className="font-display font-bold text-card-foreground">
              {isInProgress ? "In Progress ✂️" : "Live Queue"}
            </p>
            <p className="text-xs text-muted-foreground">{salon.name}</p>
          </div>
        </div>
        {!isInProgress && (
          <button onClick={handleCancel} className="text-muted-foreground hover:text-destructive transition-colors">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {isInProgress ? (
        <motion.div
          animate={{ scale: [1, 1.01, 1] }}
          transition={{ repeat: Infinity, duration: 3 }}
          className="rounded-lg bg-success/10 p-4 text-center space-y-1"
        >
          <p className="font-display text-lg font-bold text-success">Your service is in progress</p>
          <p className="text-sm text-muted-foreground">{service.name} • {service.duration} min</p>
        </motion.div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-secondary p-3">
              <Users className="mx-auto h-4 w-4 text-primary mb-1" />
              <p className="font-display text-lg font-bold text-foreground">#{aheadCount + 1}</p>
              <p className="text-xs text-muted-foreground">Position</p>
            </div>
            <div className="rounded-lg bg-secondary p-3">
              <Clock className="mx-auto h-4 w-4 text-accent mb-1" />
              <p className="font-display text-lg font-bold text-foreground">~{totalWait}m</p>
              <p className="text-xs text-muted-foreground">Wait time</p>
            </div>
            <div className="rounded-lg bg-secondary p-3">
              <Navigation className="mx-auto h-4 w-4 text-success mb-1" />
              <p className="font-display text-lg font-bold text-foreground">{travelMin}m</p>
              <p className="text-xs text-muted-foreground">Travel</p>
            </div>
          </div>

          {leaveIn > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-primary/5 px-3 py-2 text-sm">
              <MapPin className="h-4 w-4 text-primary shrink-0" />
              <span className="text-foreground">
                Leave in <span className="font-bold text-primary">{leaveIn} min</span> to arrive on time
              </span>
            </div>
          )}
          {leaveIn === 0 && totalWait > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-accent/10 px-3 py-2 text-sm">
              <MapPin className="h-4 w-4 text-accent shrink-0" />
              <span className="font-medium text-accent">Head to the salon now!</span>
            </div>
          )}

          <div className="pt-2">
            <Progress value={Math.max(10, 100 - (aheadCount * 15))} className="h-2" />
          </div>
        </>
      )}

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{service.name}</span>
        <span>•</span>
        <span>{service.duration} min</span>
        <span>•</span>
        <span>${service.price}</span>
      </div>

      {aheadCount === 0 && !isInProgress && (
        <motion.div
          animate={{ scale: [1, 1.02, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="rounded-lg bg-success/10 p-3 text-center"
        >
          <p className="font-display font-bold text-success">🎉 You're Next!</p>
        </motion.div>
      )}
    </motion.div>
  );
};

export default QueueTracker;

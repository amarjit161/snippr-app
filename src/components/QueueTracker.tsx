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
  const [queue, setQueue] = useState<Tables<"queue">[]>([]);
  const [aheadCount, setAheadCount] = useState(0);
  const [myPosition, setMyPosition] = useState<number | null>(null);
  const [totalWait, setTotalWait] = useState(0);
  const [pulseUpdate, setPulseUpdate] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const prevPosition = useRef<number | null>(null);

  const AVG_SERVICE_TIME = 20;

  const fetchQueue = async (salonId: string) => {
    const { data } = await supabase
      .from("customer_bookings")
      .select(`
        *,
        services (*),
        salons (*),
        barbers (*)
      `)
      .eq("salon_id", salonId)
      .eq("status", "waiting")
      .order("created_at", { ascending: true });

    setQueue((data as Tables<"queue">[]) || []);
    setLastUpdatedAt(new Date());
  };

  const fetchMyQueue = async () => {
    if (!user) return;

    // Check for in_progress status too (service started)
    const { data } = await supabase
      .from("customer_bookings")
      .select(`
        *,
        services (*),
        salons (*),
        barbers (*)
      `)
      .eq("user_id", user.id)
      .in("status", ["waiting", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setEntry(data as any);

      if (data.status === "in_progress") {
        setAheadCount(0);
        setMyPosition(1);
        setTotalWait(0);
        if (prevPosition.current !== -1) {
          toast.success("✂️ Your service has started!", { duration: 8000 });
          prevPosition.current = -1;
        }
        return;
      }

      await fetchQueue(data.salon_id);
    } else {
      if (entry && prevPosition.current === -1) {
        toast.success("✅ Service completed! See you next time!", { duration: 6000 });
      }
      setEntry(null);
      setQueue([]);
      setAheadCount(0);
      setMyPosition(null);
      setTotalWait(0);
      prevPosition.current = null;
    }
  };

  useEffect(() => {
    if (!entry || entry.status !== "waiting") return;

    const myIndex = queue.findIndex((q) => q.id === entry.id);
    const nextPosition = myIndex >= 0 ? myIndex + 1 : null;
    const peopleAhead = myIndex >= 0 ? myIndex : 0;
    const wait = nextPosition ? nextPosition * AVG_SERVICE_TIME : 0;

    setMyPosition(nextPosition);
    setAheadCount(peopleAhead);
    setTotalWait(wait);

    if (nextPosition && prevPosition.current !== null && prevPosition.current !== nextPosition) {
      setPulseUpdate(true);
      window.setTimeout(() => setPulseUpdate(false), 900);

      if (nextPosition === 1) {
          toast.success("🎉 You're next! Get ready!", { duration: 10000 });
        } else if (nextPosition <= 3 && (prevPosition.current || 99) > 3) {
          toast.info(`⏰ Your turn in ~${wait} minutes`, { duration: 6000 });
        } else if (nextPosition < (prevPosition.current || Number.MAX_SAFE_INTEGER)) {
          toast("Queue updated", { description: `Your position: #${nextPosition}` });
        }
      }

    if (nextPosition !== null) {
      prevPosition.current = nextPosition;
    }
  }, [AVG_SERVICE_TIME, entry, queue]);

  const clearTrackerState = () => {
    setEntry(null);
    setQueue([]);
    setAheadCount(0);
    setMyPosition(null);
    setTotalWait(0);
    prevPosition.current = null;
  };

  useEffect(() => {
    fetchMyQueue();

    const channel = supabase
      .channel(`queue-tracker-updates-${user?.id ?? "guest"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "queue", filter: `user_id=eq.${user?.id}` }, (payload) => {
        const eventType = payload.eventType;
        const nextStatus = String(((payload as any).new?.status || "")).toLowerCase();
        const payloadId = (payload as any).new?.id || (payload as any).old?.id;

        if (entry && payloadId === entry.id) {
          if (eventType === "DELETE" || (nextStatus && !["waiting", "in_progress"].includes(nextStatus))) {
            clearTrackerState();
            return;
          }
        }

        fetchMyQueue();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, entry?.id]);

  const handleCancel = async () => {
    if (!entry) return;
    const { error } = await supabase
      .from("customer_bookings")
      .update({ status: "cancelled" } as any)
      .eq("user_id", user?.id)
      .eq("status", "waiting");

    if (error) {
      toast.error("Could not cancel queue entry. Please try again.");
      return;
    }

    toast.info("Queue entry cancelled");
    clearTrackerState();
  };

  if (!entry) return null;

  const salon = entry.salons;
  const service = entry.services;
  const isInProgress = entry.status === "in_progress";

  const travelMin = location
    ? estimateTravelMinutes(location.lat, location.lng, salon.lat, salon.lng)
    : 10;
  const leaveIn = Math.max(0, totalWait - travelMin);
  const hasQueueData = queue.length > 0;

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
          <motion.div
            animate={pulseUpdate ? { scale: [1, 1.03, 1] } : { scale: 1 }}
            transition={{ duration: 0.45 }}
            className="grid grid-cols-3 gap-3 text-center"
          >
            <div className="rounded-lg bg-secondary p-3">
              <Users className="mx-auto h-4 w-4 text-primary mb-1" />
              <p className="font-display text-lg font-bold text-foreground">#{myPosition ?? "--"}</p>
              <p className="text-xs text-muted-foreground">Your position</p>
            </div>
            <div className="rounded-lg bg-secondary p-3">
              <Clock className="mx-auto h-4 w-4 text-accent mb-1" />
              <p className="font-display text-lg font-bold text-foreground">~{totalWait}m</p>
              <p className="text-xs text-muted-foreground">Estimated wait</p>
            </div>
            <div className="rounded-lg bg-secondary p-3">
              <Navigation className="mx-auto h-4 w-4 text-success mb-1" />
              <p className="font-display text-lg font-bold text-foreground">{travelMin}m</p>
              <p className="text-xs text-muted-foreground">Travel</p>
            </div>
          </motion.div>

          <div className="rounded-lg bg-primary/5 px-3 py-2 text-sm text-foreground">
            {myPosition
              ? `Your position: #${myPosition} • People ahead: ${aheadCount}`
              : hasQueueData
              ? "Not in queue"
              : "No wait"}
          </div>

          <div className="rounded-lg bg-secondary/70 px-3 py-2 text-sm text-muted-foreground">
            Estimated wait: {myPosition ? `~${totalWait} minutes` : "No wait"}
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
        <span>₹{service.price?.toLocaleString("en-IN")}</span>
      </div>

      <p className="text-xs text-muted-foreground">
        Last updated {lastUpdatedAt ? "just now" : "-"}
      </p>

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

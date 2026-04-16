import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Users, Clock, DollarSign, Play, CheckCircle2, TrendingUp, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type QueueEntry = Tables<"queue"> & { services: Tables<"services">; profileName?: string };

interface AdminDashboardProps {
  onBack: () => void;
}

const formatPrice = (amount: number) => `₹${amount.toLocaleString("en-IN")}`;

const AdminDashboard = ({ onBack }: AdminDashboardProps) => {
  const { user } = useAuth();
  const [salons, setSalons] = useState<Tables<"salons">[]>([]);
  const [selectedSalonId, setSelectedSalonId] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [analytics, setAnalytics] = useState({ totalServed: 0, avgWait: 0, peakHour: "", totalEarnings: 0 });

  useEffect(() => {
    if (!user) return;
    supabase.from("salons").select("*").eq("owner_id", user.id).then(({ data }) => {
      if (data) {
        setSalons(data);
        if (data.length > 0) setSelectedSalonId(data[0].id);
      }
    });
  }, [user]);

  const fetchQueue = async () => {
    if (!selectedSalonId) return;
    const { data } = await supabase
      .from("queue")
      .select(`
        *,
        services (*),
        salons (*),
        barbers (*)
      `)
      .eq("salon_id", selectedSalonId)
      .in("status", ["waiting", "in_progress"])
      .order("created_at", { ascending: true });
    setQueue((data as unknown as QueueEntry[]) ?? []);
  };

  const fetchAnalytics = async () => {
    if (!selectedSalonId) return;
    // All completed entries for this salon
    const { data: completed } = await supabase
      .from("queue")
      .select(`
        *,
        services (*),
        salons (*),
        barbers (*)
      `)
      .eq("salon_id", selectedSalonId)
      .eq("status", "completed");

    const items = (completed ?? []) as any[];
    const totalServed = items.length;
    const totalEarnings = items.reduce((s, e) => s + (e.services?.price ?? 0), 0);
    const avgWait = totalServed > 0
      ? Math.round(items.reduce((s, e) => s + (e.services?.duration ?? 0), 0) / totalServed)
      : 0;

    // Peak hour
    const hourCounts: Record<number, number> = {};
    const { data: allEntries } = await supabase
      .from("queue")
      .select(`
        *,
        services (*),
        salons (*),
        barbers (*)
      `)
      .eq("salon_id", selectedSalonId);
    (allEntries ?? []).forEach((e) => {
      const h = new Date(e.created_at).getHours();
      hourCounts[h] = (hourCounts[h] ?? 0) + 1;
    });
    const peakH = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];
    const peakHour = peakH ? `${peakH[0].padStart(2, "0")}:00` : "N/A";

    setAnalytics({ totalServed, avgWait, peakHour, totalEarnings });
  };

  useEffect(() => {
    fetchQueue();
    fetchAnalytics();

    if (!selectedSalonId) return;
    const channel = supabase
      .channel("admin-queue-" + selectedSalonId)
      .on("postgres_changes", { event: "*", schema: "public", table: "queue" }, () => {
        fetchQueue();
        fetchAnalytics();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedSalonId]);

  const handleStartService = async (entry: QueueEntry) => {
    await supabase.from("queue").update({ status: "in_progress", started_at: new Date().toISOString() }).eq("id", entry.id).eq("salon_id", selectedSalonId!);
    toast.success(`Started service for queue #${entry.position}`);
  };

  const handleComplete = async (entry: QueueEntry) => {
    await supabase.from("queue").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", entry.id).eq("salon_id", selectedSalonId!);
    toast.success("Service completed!");

    // Auto-progress: start next waiting entry
    const next = queue.find((q) => q.status === "waiting" && q.id !== entry.id);
    if (next) {
      await supabase.from("queue").update({ status: "in_progress", started_at: new Date().toISOString() }).eq("id", next.id).eq("salon_id", selectedSalonId!);
      toast.info(`Auto-started service for next customer`);
    }
  };

  const waitingQueue = queue.filter((q) => q.status === "waiting");
  const inProgress = queue.filter((q) => q.status === "in_progress");

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to salons
      </button>

      <div>
        <h1 className="font-display text-3xl font-extrabold text-foreground">Admin Dashboard</h1>
        <p className="text-muted-foreground">Manage queues and track performance</p>
      </div>

      {/* Salon selector */}
      <div className="flex gap-2 flex-wrap">
        {salons.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelectedSalonId(s.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              selectedSalonId === s.id ? "bg-primary text-primary-foreground shadow-elevation-1" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>

      {/* Analytics cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg bg-card shadow-elevation-1 p-4 space-y-1">
          <Users className="h-5 w-5 text-primary" />
          <p className="font-display text-2xl font-bold text-card-foreground">{analytics.totalServed}</p>
          <p className="text-xs text-muted-foreground">Customers Served</p>
        </div>
        <div className="rounded-lg bg-card shadow-elevation-1 p-4 space-y-1">
          <Clock className="h-5 w-5 text-accent" />
          <p className="font-display text-2xl font-bold text-card-foreground">{analytics.avgWait}m</p>
          <p className="text-xs text-muted-foreground">Avg Wait Time</p>
        </div>
        <div className="rounded-lg bg-card shadow-elevation-1 p-4 space-y-1">
          <TrendingUp className="h-5 w-5 text-success" />
          <p className="font-display text-2xl font-bold text-card-foreground">{analytics.peakHour}</p>
          <p className="text-xs text-muted-foreground">Peak Hour</p>
        </div>
        <div className="rounded-lg bg-card shadow-elevation-1 p-4 space-y-1">
          <DollarSign className="h-5 w-5 text-warning" />
          <p className="font-display text-2xl font-bold text-card-foreground">{formatPrice(analytics.totalEarnings)}</p>
          <p className="text-xs text-muted-foreground">Total Earnings</p>
        </div>
      </div>

      {/* In Progress */}
      {inProgress.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-success" /> In Progress
          </h2>
          {inProgress.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between rounded-lg border-2 border-success/30 bg-success/5 p-4">
              <div>
                <p className="font-medium text-foreground">{entry.services.name}</p>
                <p className="text-sm text-muted-foreground">
                  {entry.profileName ?? "Customer"} • {entry.services.duration} min
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => handleComplete(entry)} className="border-success text-success hover:bg-success hover:text-success-foreground">
                <CheckCircle2 className="h-4 w-4 mr-1" /> Complete
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Waiting Queue */}
      <div className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" /> Waiting Queue ({waitingQueue.length})
        </h2>
        {waitingQueue.length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">No one in queue right now</p>
        ) : (
          waitingQueue.map((entry, i) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center justify-between rounded-lg border border-border bg-card p-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 font-display font-bold text-primary text-sm">
                  #{i + 1}
                </div>
                <div>
                  <p className="font-medium text-foreground">{entry.services.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {entry.profileName ?? "Customer"} • {entry.services.duration} min • {formatPrice(entry.services.price)}
                  </p>
                </div>
              </div>
              <Button size="sm" onClick={() => handleStartService(entry)}>
                <Play className="h-4 w-4 mr-1" /> Start
              </Button>
            </motion.div>
          ))
        )}
      </div>
    </motion.div>
  );
};

export default AdminDashboard;

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import gsap from "gsap";
import { Loader2, CalendarDays, Activity, Timer, DollarSign, ArrowRight, Plus, Clock3, Users, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { OwnerShell } from "@/components/dashboard/OwnerShell";
import { toast } from "sonner";

type OwnerRecord = {
  id: string;
  name: string;
  email: string;
};

type SalonRow = {
  id: string;
  name: string;
  image_url: string | null;
  status: string;
};

type QueueRow = {
  id: string;
  created_at: string;
  status: string;
  user_id: string;
  services?: { name: string; price: number; duration: number } | null;
};

type ProfileLookup = { user_id: string; name: string | null };

const formatMoney = (value: number) => `INR ${value.toLocaleString("en-IN")}`;
const todayISO = () => new Date().toISOString().split("T")[0];
const statusClass: Record<string, string> = {
  waiting: "bg-amber-100 text-amber-700",
  accepted: "bg-blue-100 text-blue-700",
  in_service: "bg-violet-100 text-violet-700",
  done: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
};

const formatStatus = (value: string) => (value === "in_service" ? "In Service" : value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "));

export default function OwnerDashboard() {
  const navigate = useNavigate();
  const supabaseAny = supabase as any;
  const pageRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);
  const queueRef = useRef<HTMLElement | null>(null);

  const [owner, setOwner] = useState<OwnerRecord | null>(null);
  const [salon, setSalon] = useState<SalonRow | null>(null);
  const [queueItems, setQueueItems] = useState<QueueRow[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, string>>({});
  
  const [loadingSalon, setLoadingSalon] = useState(true);
  const [loadingData, setLoadingData] = useState(true);
  const [queueLoading, setQueueLoading] = useState(false);
  const [updatingQueueId, setUpdatingQueueId] = useState<string | null>(null);

  useLayoutEffect(() => {
    if (!pageRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from(".dashboard-animate", { y: 18, opacity: 0, duration: 0.45, stagger: 0.06, ease: "power2.out" });
    }, pageRef);
    return () => ctx.revert();
  }, [loadingSalon, loadingData, queueItems.length]);

  // Phase 1: Identity & Salon Resolution
  useEffect(() => {
    // Failsafe timer for salon loading phase
    const failsafe = setTimeout(() => {
      setLoadingSalon((current) => {
        if (current) {
          console.warn("FORCE_UNBLOCK_SALON_LOADING: Identity resolution took too long.");
          return false;
        }
        return false;
      });
    }, 5000);

    const resolveIdentity = async () => {
      try {
        console.log("LOAD_SALON_START");
        
        // Try getting identity from auth session first for maximum RLS compatibility
        const { data: { user: authUser } } = await supabase.auth.getUser();
        let ownerId = authUser?.id;

        const raw = localStorage.getItem("owner");
        if (raw) {
          const parsed = JSON.parse(raw) as OwnerRecord;
          setOwner(parsed);
          if (!ownerId) ownerId = parsed.id;
        }

        if (!ownerId) {
          console.warn("NO_IDENTITY_FOUND");
          navigate("/owner-login", { replace: true });
          return;
        }

        // Fetch salon for this owner_id
        // Handle potential PGRST116 by using select/limit instead of single
        const { data, error } = await supabaseAny
          .from("salons")
          .select("*")
          .eq("owner_id", ownerId)
          .order("created_at", { ascending: false })
          .limit(1);

        if (error) throw error;
        
        if (data && data.length > 0) {
          console.log("SALON_FOUND", data[0]);
          setSalon(data[0] as SalonRow);
        } else {
          console.warn("NO_SALON_FOUND_FOR_OWNER", ownerId);
          setSalon(null);
        }
      } catch (error: any) {
        console.error("SALON_LOAD_ERROR:", error.message || error);
        toast.error("Identity check failed. Please re-login.");
        localStorage.removeItem("owner");
        navigate("/owner-login", { replace: true });
      } finally {
        setLoadingSalon(false);
      }
    };

    resolveIdentity();

    return () => clearTimeout(failsafe);
  }, [navigate]);

  const fetchDashboardData = useCallback(async (id: string) => {
    console.log("FETCH_DASHBOARD_START", id);
    setQueueLoading(true);
    
    try {
      const { data, error } = await supabaseAny
        .from("queue")
        .select("*, services (*), barbers (*), salons (*)")
        .eq("salon_id", id)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const rows = (data as QueueRow[]) || [];
      setQueueItems(rows);

      const userIds = Array.from(new Set(rows.map((row) => row.user_id).filter(Boolean)));
      if (userIds.length > 0) {
        const { data: profileRows } = await supabaseAny.from("owners").select("id, name").in("id", userIds);
        const lookup = ((profileRows || []) as any[]).reduce<Record<string, string>>((acc, row) => {
          acc[row.id] = row.name || "Guest";
          return acc;
        }, {});
        setProfileMap(lookup);
      } else {
        setProfileMap({});
      }
      
      console.log("FETCH_DASHBOARD_SUCCESS");
    } catch (error: any) {
      console.error("FETCH_DASHBOARD_ERROR:", error.message || error);
      toast.error("Failed to load real-time data.");
    } finally {
      setQueueLoading(false);
      setLoadingData(false);
    }
  }, [supabaseAny]);

  // Phase 2: Data Orchestration
  useEffect(() => {
    if (!salon?.id) {
      setLoadingData(false);
      return;
    }

    fetchDashboardData(salon.id);
  }, [salon?.id, fetchDashboardData]);

  const summaryCards = useMemo(() => {
    const today = todayISO();
    const items = queueItems || [];
    const bookingsToday = items.filter((item) => item.created_at?.startsWith(today)).length;
    const activeQueue = items.filter((item) => ["waiting", "accepted", "in_service"].includes(item.status)).length;
    const waiting = items.filter((item) => item.status === "waiting");
    const avgDuration = waiting.length === 0 ? 0 : Math.round(waiting.reduce((sum, item) => sum + (item.services?.duration || 0), 0) / waiting.length);
    const revenueToday = items.filter((item) => item.status === "done").reduce((sum, item) => sum + (item.services?.price || 0), 0);

    return { bookingsToday, activeQueue, avgDuration, revenueToday };
  }, [queueItems]);

  const updateQueueStatus = async (item: QueueRow, nextStatus: "accepted" | "rejected" | "in_service" | "done") => {
    if (!salon?.id) return;
    setUpdatingQueueId(item.id);
    try {
      const payload: Record<string, unknown> = { status: nextStatus };
      const { error } = await supabaseAny.from("queue").update(payload).eq("id", item.id);
      
      if (error) throw error;

      toast.success(`Queue moved to ${formatStatus(nextStatus)}`);
      
      // Local refresh
      const { data } = await supabaseAny
        .from("queue")
        .select("*, services (*), barbers (*), salons (*)")
        .eq("salon_id", salon.id)
        .order("created_at", { ascending: true });
      if (data) setQueueItems(data as QueueRow[]);
      
    } catch (error: any) {
      console.error("QUEUE_UPDATE_ERROR:", error.message || error);
      toast.error(error.message || "Failed to update queue status");
    } finally {
      setUpdatingQueueId(null);
    }
  };

  console.log("OWNER_DASHBOARD_RENDER", {
    salon,
    loadingSalon,
    loadingData
  });

  if (loadingSalon) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f3f6]">
        <div className="text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
          <p className="mt-4 text-sm font-medium text-[#494551]">Resolving your salon identity...</p>
        </div>
      </div>
    );
  }

  if (!salon) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f3f6]">
        <div className="max-w-md rounded-2xl border border-[#e3e2e5] bg-white p-8 text-center shadow-sm">
          <Sparkles className="mx-auto h-12 w-12 text-amber-500" />
          <h2 className="mt-6 text-2xl font-bold">Salon Not Found</h2>
          <p className="mt-2 text-[#494551]">We couldn't find a salon associated with your account. Please register your salon to continue.</p>
          <Button className="mt-8 w-full rounded-xl" onClick={() => navigate("/register-salon")}>Register Salon</Button>
          <Button variant="outline" className="mt-3 w-full rounded-xl" onClick={() => { localStorage.removeItem("owner"); navigate("/owner-login"); }}>Logout</Button>
        </div>
      </div>
    );
  }

  if (loadingData) {
    return (
      <OwnerShell onLogout={() => { localStorage.removeItem("owner"); navigate("/owner-login", { replace: true }); }}>
        <div className="flex h-[60vh] items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
            <p className="mt-4 text-sm font-medium text-[#494551]">Orchestrating real-time dashboard...</p>
          </div>
        </div>
      </OwnerShell>
    );
  }

  if (!owner) return null;

  const queueEmpty = queueItems.length === 0;
  const profileImage = salon?.image_url || "/default-salon.jpg";

  return (
    <OwnerShell onLogout={() => { localStorage.removeItem("owner"); navigate("/owner-login", { replace: true }); }}>
      <div ref={pageRef} className="space-y-6">
        <header ref={headerRef as any} className="dashboard-animate flex flex-col gap-4 rounded-xl border border-[#e3e2e5] bg-white p-5 shadow-sm lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-semibold">Owner Dashboard</Badge>
            <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              {salon?.name || "Owner Console"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[#494551]">Operate your salon with a premium real-time workflow.</p>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-[#e3e2e5] bg-white px-4 py-3 shadow-sm">
            <div className="h-10 w-10 overflow-hidden rounded-full border-2 border-violet-200 bg-slate-100">
              <img src={profileImage} alt="Owner" className="h-full w-full object-cover" />
            </div>
            <div className="text-right">
              <p className="text-sm font-bold">{owner.name}</p>
              <p className="text-xs text-[#494551]">{owner.email}</p>
            </div>
            <Button variant="outline" className="h-9 rounded-xl" onClick={() => navigate("/settings")}>Settings</Button>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Total Customers", value: summaryCards.bookingsToday, badge: "+12%", badgeClass: "bg-green-50 text-green-700", icon: Users, iconWrap: "bg-violet-100 text-violet-700", cardClass: "bg-white", valueClass: "text-[#1a1c1e]" },
            { label: "Today's Earnings", value: formatMoney(summaryCards.revenueToday), badge: "+5.4%", badgeClass: "bg-green-50 text-green-700", icon: DollarSign, iconWrap: "bg-orange-100 text-orange-700", cardClass: "bg-white", valueClass: "text-[#1a1c1e]" },
            { label: "Active Queue count", value: summaryCards.activeQueue, badge: "Live", badgeClass: "bg-white/15 text-white", icon: Activity, iconWrap: "bg-white/20 text-white", cardClass: "bg-gradient-to-br from-primary to-primary/80 text-white", valueClass: "text-white" },
            { label: "Avg. Wait Time", value: `${summaryCards.avgDuration}m`, badge: "-2m", badgeClass: "bg-red-50 text-red-700", icon: Timer, iconWrap: "bg-amber-100 text-amber-700", cardClass: "bg-white", valueClass: "text-[#1a1c1e]" },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.label} className={`dashboard-animate rounded-xl border border-[#e3e2e5] shadow-sm ${card.cardClass}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className={`rounded-2xl p-3 ${card.iconWrap}`}><Icon className="h-5 w-5" /></div>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${card.badgeClass}`}>{card.badge}</span>
                  </div>
                  <p className="mt-4 text-xs font-bold uppercase tracking-[0.15em] text-[#6b6474]">{card.label}</p>
                  <p className={`mt-1 font-display text-3xl font-extrabold ${card.valueClass}`}>{card.value}</p>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Card className="dashboard-animate rounded-xl border border-[#e3e2e5] bg-white shadow-sm xl:col-span-2">
            <CardContent className="p-6">
              <div className="mb-6 flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-xl font-bold">Peak Traffic Trends</h3>
                  <p className="text-sm text-[#494551]">Real-time salon operations and queue metrics.</p>
                </div>
                <select className="rounded-full border border-[#e3e2e5] bg-[#f4f3f6] px-4 py-2 text-xs font-bold outline-none">
                  <option>Last 7 Days</option>
                  <option>Last 30 Days</option>
                </select>
              </div>
              <div className="relative h-56 overflow-hidden rounded-xl bg-[#f4f3f6]">
                <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="owner-chart-gradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#6750a4" stopOpacity="0.45" />
                      <stop offset="100%" stopColor="#6750a4" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M0 220 Q 140 180 250 195 T 480 150 T 760 120 T 1024 35 L 1024 256 L 0 256 Z" fill="url(#owner-chart-gradient)" />
                  <path d="M0 220 Q 140 180 250 195 T 480 150 T 760 120 T 1024 35" fill="none" stroke="#6750a4" strokeWidth="4" />
                </svg>
              </div>
            </CardContent>
          </Card>

          <Card className="dashboard-animate rounded-xl border border-[#e3e2e5] bg-[#f4f3f6] shadow-sm">
            <CardContent className="flex h-full flex-col items-center justify-center p-6 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 text-orange-600"><Plus className="h-7 w-7" /></div>
              <h3 className="font-display text-lg font-bold">New Walk-in?</h3>
              <p className="mt-2 text-sm text-[#494551]">Add customers directly to the queue without a pre-booking.</p>
              <Button className="mt-5 h-11 w-full rounded-full bg-[#1f2023] text-white hover:bg-[#2f3033]" onClick={() => navigate("/queue")}>Manual Entry</Button>
              <Button variant="outline" className="mt-3 h-11 w-full rounded-full" onClick={() => navigate("/salons")}>Add Booking</Button>
            </CardContent>
          </Card>
        </section>

        <section ref={queueRef as any} className="dashboard-animate overflow-hidden rounded-xl border border-[#e3e2e5] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#eeedf0] px-6 py-4">
            <h3 className="font-display text-xl font-bold">Live Queue Status</h3>
            <Button variant="outline" className="rounded-full" onClick={() => salon && fetchDashboardData(salon.id)} disabled={queueLoading || !salon}>
              {queueLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Refresh
            </Button>
          </div>

          {queueLoading ? (
            <div className="p-10 text-center text-sm text-[#494551]">Loading queue...</div>
          ) : queueEmpty ? (
            <div className="p-14 text-center text-sm text-[#6b6474]">No data yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead className="bg-[#f4f3f6]">
                  <tr>
                    <th className="px-6 py-3 text-[10px] uppercase tracking-[0.18em] text-[#6b6474]">Customer</th>
                    <th className="px-6 py-3 text-[10px] uppercase tracking-[0.18em] text-[#6b6474]">Service</th>
                    <th className="px-6 py-3 text-[10px] uppercase tracking-[0.18em] text-[#6b6474]">Wait Time</th>
                    <th className="px-6 py-3 text-[10px] uppercase tracking-[0.18em] text-[#6b6474]">Status</th>
                    <th className="px-6 py-3 text-[10px] uppercase tracking-[0.18em] text-[#6b6474]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eeedf0]">
                  {queueItems.map((item) => {
                    const customerName = profileMap[item.user_id] || `User ${item.user_id.slice(0, 6)}`;
                    const initials = customerName.split(" ").slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("");
                    const serviceName = item.services?.name || "Service";
                    const status = item.status || "waiting";
                    const waitTime = Math.max(1, Math.floor((Date.now() - new Date(item.created_at).getTime()) / 60000));

                    return (
                      <tr key={item.id} className="transition-colors hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">{initials || "CU"}</div>
                            <span className="text-sm font-semibold">{customerName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-[#494551]">{serviceName}</td>
                        <td className="px-6 py-4 text-sm font-semibold text-[#ab3500]">{waitTime}m</td>
                        <td className="px-6 py-4"><span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase ${statusClass[status] || "bg-slate-100 text-slate-700"}`}>{formatStatus(status)}</span></td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <Button size="sm" className="h-8 rounded-xl" disabled={updatingQueueId === item.id || status !== "waiting"} onClick={() => updateQueueStatus(item, "accepted")}>Accept</Button>
                            <Button size="sm" variant="outline" className="h-8 rounded-xl" disabled={updatingQueueId === item.id || !["waiting", "accepted"].includes(status)} onClick={() => updateQueueStatus(item, "rejected")}>Reject</Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </OwnerShell>
  );
}

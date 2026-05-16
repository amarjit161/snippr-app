import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import gsap from "gsap";
import { Loader2, CalendarDays, Activity, Timer, DollarSign, ArrowRight, Plus, Clock3, Users, Sparkles, Check, Phone, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { OwnerShell } from "@/components/dashboard/OwnerShell";
import { HolidayCalendar } from "@/components/dashboard/HolidayCalendar";
import { OTPVerifyInput } from "@/components/dashboard/OTPVerifyInput";
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
  updated_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  status: string;
  user_id: string;
  time_slot?: string | null;
  booking_date?: string | null;
  barber_id?: string | null;
  barbers?: { name?: string | null } | null;
  customer_first_name?: string | null;
  customer_last_name?: string | null;
  customer_phone?: string | null;
  services?: { name: string; price: number; duration: number } | null;
};

type ProfileLookup = { user_id: string; name: string | null };

type QueueDatePreset = "today" | "tomorrow" | "custom";

const QUEUE_DASHBOARD_SELECT = `
  id,
  created_at,
  updated_at,
  started_at,
  completed_at,
  status,
  user_id,
  time_slot,
  booking_date,
  barber_id,
  customer_first_name,
  customer_last_name,
  customer_phone,
  services (name, price, duration),
  barbers (name),
  salons (id, name, owner_id)
`;

const formatMoney = (value: number) => `INR ${value.toLocaleString("en-IN")}`;
const todayISO = () => new Date().toISOString().split("T")[0];
const tomorrowISO = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().split("T")[0];
};
const getQueueDate = (item: QueueRow) => item.booking_date || item.created_at.slice(0, 10);
const statusClass: Record<string, string> = {
  waiting: "bg-amber-100 text-amber-700",
  accepted: "bg-blue-100 text-blue-700",
  in_service: "bg-violet-100 text-violet-700",
  done: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
};

const formatStatus = (value: string) => (value === "in_service" ? "In Service" : value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "));

const minutesBetween = (from: string, to: string) => {
  const diff = Math.floor((new Date(to).getTime() - new Date(from).getTime()) / 60000);
  return Math.max(0, diff);
};

const computeQueueWaitMinutes = (item: QueueRow) => {
  const nowIso = new Date().toISOString();

  if (["waiting", "accepted"].includes(item.status)) {
    return minutesBetween(item.created_at, nowIso);
  }

  if (["in_service", "in_progress"].includes(item.status)) {
    return minutesBetween(item.created_at, item.started_at || nowIso);
  }

  if (["done", "completed"].includes(item.status)) {
    return minutesBetween(item.created_at, item.completed_at || item.started_at || item.updated_at || item.created_at);
  }

  if (["rejected", "cancelled"].includes(item.status)) {
    return minutesBetween(item.created_at, item.updated_at || item.created_at);
  }

  return minutesBetween(item.created_at, nowIso);
};

export default function OwnerDashboard() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const supabaseAny = supabase as any;
  const ACCEPT_WINDOW_MS = 15000;
  const pageRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);
  const queueRef = useRef<HTMLElement | null>(null);
  const hasFetchedRef = useRef(false);
  const isVisibleRef = useRef(true);
  const acceptTimersRef = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});

  // Track tab visibility to prevent refresh on tab switch
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      console.log("DASHBOARD_VISIBILITY_CHANGED", { isVisible });
      isVisibleRef.current = isVisible;
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []); // Prevent duplicate fetches

  const [owner, setOwner] = useState<OwnerRecord | null>(null);
  const [salon, setSalon] = useState<SalonRow | null>(null);
  const [queueItems, setQueueItems] = useState<QueueRow[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, string>>({});
  const [queueDatePreset, setQueueDatePreset] = useState<QueueDatePreset>("today");
  const [customQueueDate, setCustomQueueDate] = useState(todayISO());
  const [pendingAccepts, setPendingAccepts] = useState<Record<string, number>>({});
  
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

  // Comprehensive Identity & Dashboard Data Resolution
  useEffect(() => {
    // Only fetch once on mount, never again
    if (hasFetchedRef.current) {
      if (import.meta.env.DEV) console.log("DASHBOARD_SKIP_DUPLICATE_FETCH: Already fetched");
      return;
    }
    hasFetchedRef.current = true;

    const fetchDashboard = async () => {
      try {
        if (import.meta.env.DEV) console.log("FETCH_DASHBOARD_START");
        setLoadingSalon(true);
        setLoadingData(true);

        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          console.warn("DASHBOARD_AUTH_FAILED: No session");
          setLoadingSalon(false);
          setLoadingData(false);
          navigate("/owner-login", { replace: true });
          return;
        }

        // 0. Fetch Owner Profile
        const fetchPromise = supabase
          .from("owners")
          .select("*")
          .eq("id", authUser.id)
          .maybeSingle();
          
        const timeoutPromise = new Promise<any>((_, reject) => 
          setTimeout(() => reject(new Error("Owner query timeout")), 10000)
        );

        let ownerData, ownerError;
        try {
          const result = await Promise.race([fetchPromise, timeoutPromise]);
          ownerData = result.data;
          ownerError = result.error;
        } catch (err: any) {
          ownerError = err;
        }

        if (ownerError) {
          console.error("OWNER_FETCH_ERROR:", ownerError);
          setLoadingSalon(false);
          setLoadingData(false);
          return;
        }

        if (ownerData) {
          setOwner(ownerData as OwnerRecord);
          console.log("OWNER_PROFILE_LOADED:", ownerData.name);
        }

        // 1. Resolve Salon
        const { data: salonData, error: salonError } = await supabase
          .from("salons")
          .select("*")
          .eq("owner_id", authUser.id)
          .maybeSingle();

        if (salonError) {
          console.error("SALON_FETCH_ERROR:", salonError);
          setLoadingSalon(false);
          setLoadingData(false);
          return;
        }

        if (!salonData) {
          console.warn("SALON_NOT_FOUND_FOR_OWNER", authUser.id);
          setSalon(null);
          setLoadingSalon(false);
          setLoadingData(false);
          return;
        }

        setSalon(salonData as SalonRow);
        setLoadingSalon(false);

        // 2. Fetch Dependent Data (Queue, Barbers, Services)
        console.log("FETCHING_DEPENDENT_DATA", salonData.id);
        
        const [queueRes, barbersRes, servicesRes] = await Promise.all([
          supabase
            .from("customer_bookings")
            .select(QUEUE_DASHBOARD_SELECT)
            .eq("salon_id", salonData.id)
            .order("created_at", { ascending: false }),
          supabase.from("barbers").select("*").eq("salon_id", salonData.id),
          supabase.from("services").select("*").eq("salon_id", salonData.id)
        ]);

        if (queueRes.data) {
          const rows = queueRes.data as QueueRow[];
          setQueueItems(rows);

          // Build Profile Map for registered customers (walk-ins use customer_first_name, customer_last_name fields)
          // Try to fetch full user profiles for registered customers
          const userIds = Array.from(new Set(rows
            .filter((row) => row.user_id && !row.customer_first_name) // Only registered users without walk-in data
            .map((row) => row.user_id)
            .filter(Boolean)
          ));
          
          if (userIds.length > 0) {
            // Try to fetch user names from profiles table if it exists
            const { data: profileRows } = await (supabase as any)
              .from("profiles")
              .select("id, full_name")
              .in("id", userIds)
              .catch(() => ({ data: [] })); // Fallback if profiles table doesn't exist
            
            const lookup = ((profileRows || []) as any[]).reduce<Record<string, string>>((acc, row) => {
              acc[row.id] = row.full_name || "Guest";
              return acc;
            }, {});
            setProfileMap(lookup);
          }
        }

        // Barbers & Services aren't currently in standalone state apart from the queue join, 
        // but we keep the logic ready if needed for other UI parts.

        console.log("FETCH_DASHBOARD_SUCCESS");
      } catch (err: any) {
        console.error("DASHBOARD_CRITICAL_ERROR:", err);
      } finally {
        setLoadingSalon(false);
        setLoadingData(false);
      }
    };

    fetchDashboard();
  }, []); // Only run once on mount, never again

  // Keep manual refresh logic
  const fetchDashboardData = useCallback(async (id: string) => {
    setQueueLoading(true);
    try {
            const { data, error } = await (supabase as any)
        .from("customer_bookings")
        .select(QUEUE_DASHBOARD_SELECT)
        .eq("salon_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setQueueItems((data as QueueRow[]) || []);
    } catch (error: any) {
      console.error("REFRESH_ERROR:", error);
      toast.error("Failed to refresh data.");
    } finally {
      setQueueLoading(false);
    }
  }, []);

  // Fetch full queue item details with relations for real-time events
  const fetchQueueItemFull = useCallback(async (queueId: string) => {
    try {
      const { data } = await supabase
        .from("customer_bookings")
        .select(QUEUE_DASHBOARD_SELECT)
        .eq("id", queueId)
        .maybeSingle();
      return data as QueueRow | null;
    } catch (err) {
      console.error("FETCH_QUEUE_ITEM_ERROR", err);
      return null;
    }
  }, []);

  // Intelligent merge for real-time updates (Swiggy/Uber style - no flicker)
  const mergeQueueUpdate = useCallback((payload: any) => {
    const { eventType, new: newRow, old: oldRow } = payload;
    
    setQueueItems((prev) => {
      if (eventType === "DELETE" && oldRow) {
        return prev.filter((item) => item.id !== oldRow.id);
      }
      
      if (eventType === "INSERT" && newRow) {
        // For new items, fetch full details asynchronously
        fetchQueueItemFull(newRow.id).then((fullItem) => {
          if (fullItem) {
            setQueueItems((current) => {
              const exists = current.some((item) => item.id === fullItem.id);
              if (exists) return current; // Already added
              return [fullItem, ...current];
            });
          }
        });
        // Add placeholder immediately for instant feedback
        return [{ ...newRow, services: null, barbers: null } as QueueRow, ...prev];
      }
      
      if (eventType === "UPDATE" && newRow) {
        // For updates, also fetch full details
        fetchQueueItemFull(newRow.id).then((fullItem) => {
          if (fullItem) {
            setQueueItems((current) =>
              current.map((item) => (item.id === fullItem.id ? fullItem : item))
            );
          }
        });
        // Update with new data immediately
        return prev.map((item) => (item.id === newRow.id ? { ...item, ...newRow } as QueueRow : item));
      }
      
      return prev;
    });
  }, [fetchQueueItemFull]);

  // Real-time subscription for queue updates (silent background sync - no flicker)
  useEffect(() => {
    if (!salon?.id) return;

    console.log("DASHBOARD_REALTIME_SUBSCRIPTION_START", salon.id);

    const channel = supabase
      .channel(`customer_bookings-updates-${salon.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "customer_bookings",
          filter: `salon_id=eq.${salon.id}`
        },
        (payload) => {
          console.log("DASHBOARD_QUEUE_REALTIME_EVENT", payload.eventType, payload.new?.id);
          // Merge the update intelligently without full refetch (no flicker!)
          mergeQueueUpdate(payload);
        }
      )
      .subscribe((status) => {
        console.log("DASHBOARD_REALTIME_STATUS", status);
        if (status === "SUBSCRIBED") {
          fetchDashboardData(salon.id);
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          window.setTimeout(() => fetchDashboardData(salon.id), 1500);
        }
      });

<<<<<<< HEAD
    // Safety fallback: If no real-time events in 60 seconds, do a smart comparison check
    const interval = setInterval(async () => {
      const now = Date.now();
      if (now - lastEventTime > 60000) {
        console.log("DASHBOARD_FALLBACK_SYNC: No real-time events for 60s, checking for missed updates");
        try {
          const { data } = await supabase
            .from("queue")
            .select("id, status, created_at")
            .eq("salon_id", salon.id)
            .order("created_at", { ascending: false })
            .limit(1);

          if (data && data.length > 0) {
            const latestId = data[0].id;
            const currentLatestId = queueItems?.[0]?.id;
            
            // Only full refresh if we're missing the latest item
            if (latestId !== currentLatestId) {
              console.log("DASHBOARD_FALLBACK_DETECTED_MISSING_ITEMS, refreshing");
              fetchDashboardData(salon.id);
            }
          }
        } catch (err) {
          console.error("DASHBOARD_FALLBACK_ERROR", err);
        }
=======
    const recoverDashboard = () => fetchDashboardData(salon.id);
    const recoverWhenVisible = () => {
      if (!document.hidden) {
        recoverDashboard();
>>>>>>> 5bab213 (Save local changes: update components, hooks, services, and migrations)
      }
    };
    window.addEventListener("online", recoverDashboard);
    document.addEventListener("visibilitychange", recoverWhenVisible);

        const recoverDashboard = () => fetchDashboardData(salon.id);
        const recoverWhenVisible = () => {
          if (!document.hidden) {
            recoverDashboard();
          }
        };
        window.addEventListener("online", recoverDashboard);
        document.addEventListener("visibilitychange", recoverWhenVisible);
      if (!prev[queueId]) return prev;
      const next = { ...prev };
      delete next[queueId];
      return next;
    });
  }, []);

  useEffect(() => {
    const acceptedIds = new Set(queueItems.filter((item) => item.status === "accepted").map((item) => item.id));
    setPendingAccepts((prev) => {
      let changed = false;
      const next = { ...prev };
      Object.keys(next).forEach((queueId) => {
        if (!acceptedIds.has(queueId)) {
          changed = true;
          delete next[queueId];
          const timer = acceptTimersRef.current[queueId];
          if (timer) clearTimeout(timer);
          delete acceptTimersRef.current[queueId];
        }
      });
      return changed ? next : prev;
    });
  }, [queueItems]);

  const beginAccept = useCallback(async (item: QueueRow) => {
    if (!salon?.id) return;
    setUpdatingQueueId(item.id);
    try {
      clearAcceptTimer(item.id);
      const { error } = await supabaseAny.from("queue").update({ status: "accepted", started_at: null }).eq("id", item.id);
      if (error) throw error;

      const expiresAt = Date.now() + ACCEPT_WINDOW_MS;
      const timer = setTimeout(async () => {
        delete acceptTimersRef.current[item.id];
        setPendingAccepts((prev) => {
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
        await supabaseAny.from("queue").update({ status: "in_progress", started_at: new Date().toISOString() }).eq("id", item.id);
      }, ACCEPT_WINDOW_MS);

      acceptTimersRef.current[item.id] = timer;
      setPendingAccepts((prev) => ({ ...prev, [item.id]: expiresAt }));
      setQueueItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, status: "accepted", started_at: null } : row)));
    } catch (error: any) {
      console.error("QUEUE_ACCEPT_ERROR:", error.message || error);
      toast.error(error.message || "Failed to accept queue item");
    } finally {
      setUpdatingQueueId(null);
    }
  }, [ACCEPT_WINDOW_MS, clearAcceptTimer, salon?.id, supabaseAny]);

  const undoAccept = useCallback(async (queueId: string) => {
    if (!salon?.id) return;
    setUpdatingQueueId(queueId);
    try {
      clearAcceptTimer(queueId);
      const { error } = await supabaseAny.from("queue").update({ status: "waiting", started_at: null }).eq("id", queueId);
      if (error) throw error;
      setQueueItems((prev) => prev.map((row) => (row.id === queueId ? { ...row, status: "waiting", started_at: null } : row)));
      toast.success("Accept undone");
    } catch (error: any) {
      console.error("QUEUE_UNDO_ERROR:", error.message || error);
      toast.error(error.message || "Failed to undo accept");
    } finally {
      setUpdatingQueueId(null);
    }
  }, [clearAcceptTimer, salon?.id, supabaseAny]);

  const updateQueueStatus = async (item: QueueRow, nextStatus: "accepted" | "rejected" | "in_service" | "done" | "waiting") => {
    if (!salon?.id) return;
    setUpdatingQueueId(item.id);
    try {
      const payload: Record<string, unknown> = { status: nextStatus };
      if (nextStatus === "waiting" || nextStatus === "accepted") payload.started_at = null;
      const { error } = await supabaseAny.from("queue").update(payload).eq("id", item.id);
      
      if (error) throw error;

      toast.success(`Queue moved to ${formatStatus(nextStatus)}`);
      
      // Local refresh
            const { data } = await supabaseAny
        .from("customer_bookings")
        .select(QUEUE_DASHBOARD_SELECT)
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
          <Button variant="outline" className="mt-3 w-full rounded-xl" onClick={() => { signOut(); navigate("/owner-login"); }}>Logout</Button>
        </div>
      </div>
    );
  }

  if (loadingData) {
    return (
      <OwnerShell onLogout={() => { signOut(); navigate("/owner-login", { replace: true }); }}>
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

  const queueEmpty = filteredQueueItems.length === 0;
  const profileImage = salon?.image_url || "/default-salon.jpg";
  const activeQueueItems = filteredQueueItems
    .filter((item) => ["waiting", "accepted", "in_service"].includes(item.status))
    .slice(0, 6);

  return (
    <OwnerShell onLogout={() => { signOut(); navigate("/owner-login", { replace: true }); }}>
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

        <section className="dashboard-animate grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Card className="rounded-xl border border-[#e3e2e5] bg-white shadow-sm xl:col-span-2">
            <CardContent className="p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-display text-2xl font-bold">Live Queue</h3>
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={queueDatePreset}
                    onChange={(event) => setQueueDatePreset(event.target.value as QueueDatePreset)}
                    className="h-10 rounded-full border border-[#e3e2e5] bg-white px-4 text-sm font-semibold outline-none"
                  >
                    <option value="today">Today</option>
                    <option value="tomorrow">Tomorrow</option>
                    <option value="custom">Pick date</option>
                  </select>
                  {queueDatePreset === "custom" ? (
                    <input
                      type="date"
                      value={customQueueDate}
                      onChange={(event) => setCustomQueueDate(event.target.value)}
                      className="h-10 rounded-full border border-[#e3e2e5] bg-white px-4 text-sm font-semibold outline-none"
                    />
                  ) : null}
                  <span className="rounded-full border border-[#1f2023] px-3 py-1 text-xs font-bold">
                    {activeQueueItems.length} people waiting
                  </span>
                </div>
              </div>

              {activeQueueItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#d9d6df] p-10 text-center text-sm text-[#6b6474]">
                  No active queue for this date.
                </div>
              ) : (
                <div className="space-y-3">
                  {activeQueueItems.map((item) => {
                    const walkinName = (item as any).customer_first_name && (item as any).customer_last_name
                      ? `${(item as any).customer_first_name} ${(item as any).customer_last_name}`
                      : (item as any).customer_phone
                        ? `${(item as any).customer_phone}`
                        : null;
                    const customerName = walkinName || profileMap[item.user_id] || `User ${item.user_id.slice(0, 6)}`;
                    const initials = customerName.split(" ").slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("");
                    const serviceName = item.services?.name || "Service";
                    const barberName = (item as any).barbers?.name || "Not assigned";
                    const bookingTime = item.time_slot
                      ? item.time_slot.slice(0, 5)
                      : new Date(item.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
                    const isPendingAccept = !!pendingAccepts[item.id];
                    const remainingMs = pendingAccepts[item.id] ? Math.max(0, pendingAccepts[item.id] - Date.now()) : 0;
                    const remainingSeconds = Math.ceil(remainingMs / 1000);
                    const progressPercent = pendingAccepts[item.id] ? (remainingMs / ACCEPT_WINDOW_MS) * 100 : 0;

                    return (
                      <>
                        <div key={item.id} className="flex flex-col gap-3 rounded-2xl border border-[#eeedf0] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-100 text-lg font-bold text-violet-700">
                            {initials || "C"}
                          </div>
                          <div>
                            <p className="text-lg font-bold text-[#1a1c1e]">{customerName}</p>
                            <p className="text-sm text-[#656170]">✂ {serviceName} <span className="mx-1">•</span> Barber: {barberName}</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 sm:justify-end">
                          <div className="text-right">
                            <p className="text-2xl font-extrabold leading-none text-[#101828]">{bookingTime}</p>
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6b6474]">Scheduled</p>
                          </div>
                          {item.status === "waiting" && canAcceptSelectedDate ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 rounded-full text-emerald-600 hover:bg-emerald-50"
                              disabled={updatingQueueId === item.id}
                              onClick={() => beginAccept(item)}
                              title="Accept"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          ) : null}
                          {isPendingAccept ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-full border-amber-300 text-amber-700 hover:bg-amber-50"
                              disabled={updatingQueueId === item.id}
                              onClick={() => undoAccept(item.id)}
                            >
                              Undo {remainingSeconds}s
                            </Button>
                          ) : null}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-full text-slate-500 hover:bg-slate-100"
                            title="Call"
                          >
                            <Phone className="h-4 w-4" />
                          </Button>
                          {canAcceptSelectedDate ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 rounded-full text-rose-600 hover:bg-rose-50"
                              disabled={updatingQueueId === item.id}
                              onClick={() => updateQueueStatus(item, "rejected")}
                              title="Reject"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </div>
                      </div>
                      {isPendingAccept ? (
                        <div className="mt-3 space-y-1">
                          <div className="h-1 overflow-hidden rounded-full bg-amber-100">
                            <div className="h-full rounded-full bg-amber-500 transition-all duration-200" style={{ width: `${progressPercent}%` }} />
                          </div>
                          <p className="text-[11px] text-amber-700">Accepting in {remainingSeconds}s. Undo if needed.</p>
                        </div>
                      ) : null}
                      
                      {/* OTP Verification Input - shown for waiting/confirmed status */}
                      {(item.status === "waiting" || item.status === "confirmed") && (
                        <OTPVerifyInput
                          bookingId={item.id}
                          customerName={customerName}
                          currentStatus={item.status}
                          onVerified={() => {
                            // Refresh the queue when OTP is verified
                            if (salon?.id) fetchDashboardData(salon.id);
                          }}
                        />
                      )}
                      </>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-[#e3e2e5] bg-white shadow-sm">
            <CardContent className="p-6">
              <h4 className="text-2xl font-bold text-[#1a1c1e]">Barber Status</h4>
              <div className="mt-4 space-y-3">
                {[
                  { name: "Marcus", status: "Busy", tone: "bg-amber-400" },
                  { name: "Sarah", status: "Available", tone: "bg-emerald-500" },
                  { name: "David", status: "On Break", tone: "bg-slate-400" },
                ].map((entry) => (
                  <div key={entry.name} className="flex items-center justify-between rounded-xl border border-[#eeedf0] px-3 py-2">
                    <p className="text-lg font-semibold text-[#202328]">{entry.name}</p>
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#1f2023] px-2 py-1 text-xs font-bold">
                      <span className={`h-2 w-2 rounded-full ${entry.tone}`} />
                      {entry.status}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <section ref={queueRef as any} className="dashboard-animate overflow-hidden rounded-xl border border-[#e3e2e5] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eeedf0] px-6 py-4">
            <h3 className="font-display text-xl font-bold">Live Queue Status</h3>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={queueDatePreset}
                onChange={(event) => setQueueDatePreset(event.target.value as QueueDatePreset)}
                className="h-10 rounded-full border border-[#e3e2e5] bg-[#f4f3f6] px-4 text-sm font-semibold outline-none"
              >
                <option value="today">Today</option>
                <option value="tomorrow">Tomorrow</option>
                <option value="custom">Pick date</option>
              </select>
              {queueDatePreset === "custom" ? (
                <input
                  type="date"
                  value={customQueueDate}
                  onChange={(event) => setCustomQueueDate(event.target.value)}
                  className="h-10 rounded-full border border-[#e3e2e5] bg-[#f4f3f6] px-4 text-sm font-semibold outline-none"
                />
              ) : null}
              <Button variant="outline" className="rounded-full" onClick={() => salon && fetchDashboardData(salon.id)} disabled={queueLoading || !salon}>
                {queueLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Refresh
              </Button>
            </div>
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
                  {filteredQueueItems.map((item) => {
                    const walkinName = (item as any).customer_first_name && (item as any).customer_last_name 
                      ? `${(item as any).customer_first_name} ${(item as any).customer_last_name}`
                      : (item as any).customer_phone ? `${(item as any).customer_phone}` : null;
                    const customerName = walkinName || profileMap[item.user_id] || `User ${item.user_id.slice(0, 6)}`;
                    const initials = customerName.split(" ").slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("");
                    const serviceName = item.services?.name || "Service";
                    const status = item.status || "waiting";
                    const waitTime = computeQueueWaitMinutes(item);

                    return (
                      <tr key={item.id} className="animate-in fade-in duration-500 transition-all hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">{initials || "CU"}</div>
                            <span className="text-sm font-semibold">{customerName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-[#494551]">{serviceName}</td>
                        <td className="px-6 py-4 text-sm font-semibold text-[#ab3500]">{waitTime}m</td>
                        <td className="px-6 py-4"><span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase transition-colors ${statusClass[status] || "bg-slate-100 text-slate-700"}`}>{formatStatus(status)}</span></td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                              {status === "waiting" && canAcceptSelectedDate ? (
                                <Button size="sm" className="h-8 rounded-xl" disabled={updatingQueueId === item.id} onClick={() => beginAccept(item)}>Accept</Button>
                              ) : null}
                              {pendingAccepts[item.id] ? (
                                <Button size="sm" variant="outline" className="h-8 rounded-xl border-amber-300 text-amber-700 hover:bg-amber-50" disabled={updatingQueueId === item.id} onClick={() => undoAccept(item.id)}>
                                  Undo {Math.ceil(Math.max(0, pendingAccepts[item.id] - Date.now()) / 1000)}s
                                </Button>
                              ) : null}
                              {canAcceptSelectedDate ? (
                                <Button size="sm" variant="outline" className="h-8 rounded-xl" disabled={updatingQueueId === item.id || !["waiting", "accepted"].includes(status)} onClick={() => updateQueueStatus(item, "rejected")}>Reject</Button>
                              ) : null}
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

        {salon && (
              <div className="mt-8 mb-8">
            <HolidayCalendar salonId={salon.id} />
          </div>
        )}

      </div>
    </OwnerShell>
  );
}


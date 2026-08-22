import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  Loader2,
  Sparkles,
  DollarSign,
  CalendarDays,
  Users,
  TrendingUp,
  Scissors,
  Clock,
  Award,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { OwnerShell } from "@/components/dashboard/OwnerShell";
import { formatINR } from "@/lib/currency";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SalonRow = { id: string; name: string };

type BarberRow = { id: string; name: string };

type BookingAnalyticsRow = {
  id: string;
  status: string | null;
  customer_id: string | null;
  booking_date: string | null;
  booking_time: string | null;
  created_at: string | null;
  service_id: string | null;
  stylist_id: string | null;
  services: { name: string; price: number | null } | null;
  barbers: { name: string } | null;
};

type Period = "today" | "7d" | "30d" | "90d";

const PERIODS: { key: Period; label: string; days: number }[] = [
  { key: "today", label: "Today", days: 0 },
  { key: "7d", label: "7D", days: 6 },
  { key: "30d", label: "30D", days: 29 },
  { key: "90d", label: "90D", days: 89 },
];

const COMPLETED_STATUSES = new Set(["done", "completed"]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const todayISO = () => isoDate(new Date());

const periodStart = (period: Period): string => {
  const days = PERIODS.find((p) => p.key === period)?.days ?? 0;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return isoDate(d);
};

const effectiveDate = (row: BookingAnalyticsRow): string => {
  if (row.booking_date) return row.booking_date.slice(0, 10);
  if (row.created_at) return row.created_at.slice(0, 10);
  return "";
};

const bookingHour = (row: BookingAnalyticsRow): number | null => {
  if (!row.booking_time) return null;
  const raw = row.booking_time.split(":")[0];
  const hour = parseInt(raw, 10);
  return Number.isNaN(hour) ? null : hour;
};

const isCompleted = (row: BookingAnalyticsRow) => COMPLETED_STATUSES.has((row.status || "").toLowerCase());

const hourLabel = (h: number): string => {
  const suffix = h < 12 ? "AM" : "PM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}${suffix}`;
};

const buildDateBuckets = (startISO: string, endISO: string): string[] => {
  const dates: string[] = [];
  const cur = new Date(`${startISO}T00:00:00`);
  const end = new Date(`${endISO}T00:00:00`);
  while (cur <= end) {
    dates.push(isoDate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
};

const buildWeekBuckets = (startISO: string, endISO: string): { key: string; start: string; end: string }[] => {
  const buckets: { key: string; start: string; end: string }[] = [];
  const cur = new Date(`${startISO}T00:00:00`);
  const end = new Date(`${endISO}T00:00:00`);
  while (cur <= end) {
    const bucketStart = new Date(cur);
    const bucketEnd = new Date(cur);
    bucketEnd.setDate(bucketEnd.getDate() + 6);
    const clampedEnd = bucketEnd > end ? end : bucketEnd;
    buckets.push({ key: isoDate(bucketStart), start: isoDate(bucketStart), end: isoDate(clampedEnd) });
    cur.setDate(cur.getDate() + 7);
  }
  return buckets;
};

const formatINRCompact = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

// ---------------------------------------------------------------------------
// Chart gating (Recharts zero-width-on-first-render mitigation)
// ---------------------------------------------------------------------------

function useChartReady(active: boolean) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!active || ready) return;
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setReady(true);
          obs.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [active, ready]);

  return { ref, ready };
}

function ChartShimmer({ height }: { height: number }) {
  return (
    <div
      className="relative overflow-hidden rounded-xl bg-muted"
      style={{ height }}
      aria-label="Loading chart"
    >
      <div
        className="absolute inset-y-0 w-1/2 animate-[shimmer_1.4s_ease-in-out_infinite]"
        style={{ background: "linear-gradient(90deg, transparent, hsl(var(--foreground)/0.06), transparent)" }}
      />
    </div>
  );
}

function EmptyChartState({ label = "No data for this period yet." }: { label?: string }) {
  return (
    <div className="flex h-full min-h-[160px] items-center justify-center rounded-xl border border-dashed border-border text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OwnerAnalytics() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const supabaseAny = supabase as any;
  const hasFetchedRef = useRef(false);

  const [salon, setSalon] = useState<SalonRow | null>(null);
  const [barbers, setBarbers] = useState<BarberRow[]>([]);
  const [bookings, setBookings] = useState<BookingAnalyticsRow[]>([]);
  const [period, setPeriod] = useState<Period>("7d");

  const [loadingSalon, setLoadingSalon] = useState(true);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    const load = async () => {
      try {
        setLoadingSalon(true);
        setLoadingData(true);

        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();

        if (!authUser) {
          navigate("/owner-login", { replace: true });
          return;
        }

        const { data: salonData, error: salonError } = await supabase
          .from("salons")
          .select("id, name")
          .eq("owner_id", authUser.id)
          .maybeSingle();

        if (salonError) {
          console.error("ANALYTICS_SALON_FETCH_ERROR:", salonError);
          setLoadingSalon(false);
          setLoadingData(false);
          return;
        }

        if (!salonData) {
          setSalon(null);
          setLoadingSalon(false);
          setLoadingData(false);
          return;
        }

        setSalon(salonData as SalonRow);
        setLoadingSalon(false);

        const [bookingsRes, barbersRes] = await Promise.all([
          supabaseAny
            .from("bookings")
            .select(
              "id, status, customer_id, booking_date, booking_time, created_at, service_id, stylist_id, services(name, price), barbers(name)"
            )
            .eq("salon_id", (salonData as SalonRow).id)
            .order("created_at", { ascending: false })
            .limit(5000),
          supabase.from("barbers").select("id, name").eq("salon_id", (salonData as SalonRow).id).limit(100),
        ]);

        if (bookingsRes.data) setBookings(bookingsRes.data as BookingAnalyticsRow[]);
        if (barbersRes.data) setBarbers(barbersRes.data as BarberRow[]);
      } catch (err) {
        console.error("ANALYTICS_CRITICAL_ERROR:", err);
      } finally {
        setLoadingData(false);
      }
    };

    load();
  }, [navigate, supabaseAny]);

  // -------------------------------------------------------------------------
  // Derived data — everything below is computed strictly from fetched rows
  // -------------------------------------------------------------------------

  const periodBookings = useMemo(() => {
    const start = periodStart(period);
    const end = todayISO();
    return bookings.filter((b) => {
      const d = effectiveDate(b);
      return !!d && d >= start && d <= end;
    });
  }, [bookings, period]);

  const kpis = useMemo(() => {
    const completed = periodBookings.filter(isCompleted);
    const revenue = completed.reduce((sum, b) => sum + (b.services?.price || 0), 0);
    const totalBookings = periodBookings.length;
    const uniqueCustomers = new Set(periodBookings.map((b) => b.customer_id).filter(Boolean)).size;
    const avgBookingValue = completed.length > 0 ? revenue / completed.length : null;
    return { revenue, totalBookings, uniqueCustomers, avgBookingValue, completedCount: completed.length };
  }, [periodBookings]);

  const revenueTrend = useMemo(() => {
    const completed = periodBookings.filter(isCompleted);

    if (period === "today") {
      return Array.from({ length: 24 }, (_, h) => {
        const revenue = completed
          .filter((b) => bookingHour(b) === h)
          .reduce((sum, b) => sum + (b.services?.price || 0), 0);
        return { key: String(h), label: hourLabel(h), revenue };
      });
    }

    const start = periodStart(period);
    const end = todayISO();

    if (period === "90d") {
      return buildWeekBuckets(start, end).map((w) => {
        const revenue = completed
          .filter((b) => {
            const d = effectiveDate(b);
            return d >= w.start && d <= w.end;
          })
          .reduce((sum, b) => sum + (b.services?.price || 0), 0);
        const label = new Date(`${w.start}T00:00:00`).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
        return { key: w.key, label, revenue };
      });
    }

    return buildDateBuckets(start, end).map((d) => {
      const revenue = completed
        .filter((b) => effectiveDate(b) === d)
        .reduce((sum, b) => sum + (b.services?.price || 0), 0);
      const label = new Date(`${d}T00:00:00`).toLocaleDateString(
        "en-IN",
        period === "7d" ? { weekday: "short" } : { month: "short", day: "numeric" }
      );
      return { key: d, label, revenue };
    });
  }, [periodBookings, period]);

  const popularServices = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>();
    periodBookings.forEach((b) => {
      const name = b.services?.name;
      if (!name) return;
      const key = b.service_id || name;
      const cur = map.get(key) || { name, count: 0 };
      cur.count += 1;
      map.set(key, cur);
    });
    return Array.from(map.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [periodBookings]);

  const peakHours = useMemo(() => {
    const counts = new Array(24).fill(0);
    periodBookings.forEach((b) => {
      const h = bookingHour(b);
      if (h !== null && h >= 0 && h < 24) counts[h] += 1;
    });
    return counts.map((count, h) => ({ hour: h, label: hourLabel(h), count }));
  }, [periodBookings]);

  const staffPerformance = useMemo(() => {
    const map = new Map<string, { name: string; bookings: number; revenue: number }>();
    barbers.forEach((b) => map.set(b.id, { name: b.name, bookings: 0, revenue: 0 }));
    periodBookings.forEach((b) => {
      if (!b.stylist_id) return;
      const existing = map.get(b.stylist_id) || { name: b.barbers?.name || "Unassigned", bookings: 0, revenue: 0 };
      existing.bookings += 1;
      if (isCompleted(b)) existing.revenue += b.services?.price || 0;
      map.set(b.stylist_id, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue || b.bookings - a.bookings);
  }, [periodBookings, barbers]);

  const hasPeriodData = periodBookings.length > 0;

  const revenueChart = useChartReady(!loadingData && !!salon);
  const servicesChart = useChartReady(!loadingData && !!salon);
  const hoursChart = useChartReady(!loadingData && !!salon);

  const periodRangeLabel = useMemo(() => {
    const start = periodStart(period);
    const end = todayISO();
    const fmt = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
    return period === "today" ? fmt(end) : `${fmt(start)} — ${fmt(end)}`;
  }, [period]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (loadingSalon) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted">
        <div className="text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
          <p className="mt-4 text-sm font-medium text-muted-foreground">Resolving your salon identity...</p>
        </div>
      </div>
    );
  }

  if (!salon) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted">
        <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <Sparkles className="mx-auto h-12 w-12 text-amber-500" />
          <h2 className="mt-6 text-2xl font-bold">Salon Not Found</h2>
          <p className="mt-2 text-muted-foreground">
            We couldn't find a salon associated with your account. Please register your salon to continue.
          </p>
          <Button className="mt-8 w-full rounded-xl" onClick={() => navigate("/register-salon")}>
            Register Salon
          </Button>
          <Button
            variant="outline"
            className="mt-3 w-full rounded-xl"
            onClick={() => {
              signOut();
              navigate("/owner-login");
            }}
          >
            Logout
          </Button>
        </div>
      </div>
    );
  }

  if (loadingData) {
    return (
      <OwnerShell
        onLogout={() => {
          signOut();
          navigate("/owner-login", { replace: true });
        }}
      >
        <div className="space-y-6">
          <Skeleton className="h-24 w-full rounded-xl" />
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-72 w-full rounded-xl" />
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Skeleton className="h-64 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </OwnerShell>
    );
  }

  const kpiCards = [
    {
      label: "Total Revenue",
      value: formatINR(kpis.revenue),
      icon: DollarSign,
      iconWrap: "bg-emerald-100 text-emerald-700",
    },
    {
      label: "Total Bookings",
      value: kpis.totalBookings.toLocaleString("en-IN"),
      icon: CalendarDays,
      iconWrap: "bg-violet-100 text-violet-700",
    },
    {
      label: "Unique Customers",
      value: kpis.uniqueCustomers.toLocaleString("en-IN"),
      icon: Users,
      iconWrap: "bg-orange-100 text-orange-700",
    },
    {
      label: "Avg. Booking Value",
      value: kpis.avgBookingValue !== null ? formatINR(kpis.avgBookingValue) : "—",
      icon: TrendingUp,
      iconWrap: "bg-amber-100 text-amber-700",
    },
  ];

  return (
    <OwnerShell
      onLogout={() => {
        signOut();
        navigate("/owner-login", { replace: true });
      }}
    >
      <style>{`@keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(200%); } }`}</style>
      <div className="space-y-6">
        <header className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-sm lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-semibold">
              Analytics
            </Badge>
            <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              {salon.name || "Your Salon"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Real performance data for <span className="font-mono">{periodRangeLabel}</span>.
            </p>
          </div>

          <div className="inline-flex items-center gap-1 self-start rounded-full border border-border bg-muted p-1">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPeriod(p.key)}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
                  period === p.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </header>

        <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          {kpiCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.label} className="rounded-xl border border-border bg-card shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className={`rounded-2xl p-3 ${card.iconWrap}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="mt-4 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">{card.label}</p>
                  <p className="mt-1 font-display text-3xl font-extrabold font-mono text-foreground">{card.value}</p>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <Card className="rounded-xl border border-border bg-card shadow-sm">
          <CardContent className="p-6">
            <div className="mb-6 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-xl font-bold">Revenue Trend</h3>
                <p className="text-sm text-muted-foreground">
                  Completed bookings, {period === "today" ? "by hour" : period === "90d" ? "by week" : "by day"}.
                </p>
              </div>
            </div>
            <div ref={revenueChart.ref} className="h-64 w-full">
              {!hasPeriodData ? (
                <EmptyChartState />
              ) : !revenueChart.ready ? (
                <ChartShimmer height={256} />
              ) : (
                <ResponsiveContainer width="100%" height={256}>
                  <AreaChart data={revenueTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="analytics-revenue-gradient" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      tickFormatter={(v) => formatINRCompact(Number(v))}
                      width={64}
                    />
                    <Tooltip
                      formatter={(v) => [formatINR(Number(v)), "Revenue"]}
                      contentStyle={{ borderRadius: 10, fontSize: 12, border: "1px solid hsl(var(--border))" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fill="url(#analytics-revenue-gradient)"
                      isAnimationActive
                      animationDuration={800}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card className="rounded-xl border border-border bg-card shadow-sm">
            <CardContent className="p-6">
              <div className="mb-5 flex items-center gap-2">
                <Scissors className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-display text-xl font-bold">Popular Services</h3>
              </div>
              <div ref={servicesChart.ref} className="h-56 w-full">
                {!hasPeriodData || popularServices.length === 0 ? (
                  <EmptyChartState />
                ) : !servicesChart.ready ? (
                  <ChartShimmer height={224} />
                ) : (
                  <ResponsiveContainer width="100%" height={224}>
                    <BarChart data={popularServices} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                      <XAxis type="number" hide allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={110}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      />
                      <Tooltip
                        formatter={(v) => [`${v} booking${Number(v) === 1 ? "" : "s"}`, "Bookings"]}
                        contentStyle={{ borderRadius: 10, fontSize: 12, border: "1px solid hsl(var(--border))" }}
                      />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} barSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-border bg-card shadow-sm">
            <CardContent className="p-6">
              <div className="mb-5 flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-display text-xl font-bold">Peak Hours</h3>
              </div>
              <div ref={hoursChart.ref} className="h-56 w-full">
                {!hasPeriodData ? (
                  <EmptyChartState />
                ) : !hoursChart.ready ? (
                  <ChartShimmer height={224} />
                ) : (
                  <ResponsiveContainer width="100%" height={224}>
                    <BarChart data={peakHours} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <XAxis
                        dataKey="label"
                        axisLine={false}
                        tickLine={false}
                        interval={2}
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      />
                      <YAxis hide allowDecimals={false} />
                      <Tooltip
                        formatter={(v) => [`${v} booking${Number(v) === 1 ? "" : "s"}`, "Bookings"]}
                        contentStyle={{ borderRadius: 10, fontSize: 12, border: "1px solid hsl(var(--border))" }}
                      />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        <Card className="rounded-xl border border-border bg-card shadow-sm">
          <CardContent className="p-6">
            <div className="mb-5 flex items-center gap-2">
              <Award className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-display text-xl font-bold">Staff Performance</h3>
            </div>
            {staffPerformance.length === 0 ? (
              <p className="text-sm text-muted-foreground">No staff added yet.</p>
            ) : (
              <div className="space-y-3">
                {staffPerformance.map((staff, index) => (
                  <div
                    key={staff.name + index}
                    className="flex items-center justify-between rounded-xl border border-border px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-700">
                        {index + 1}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">{staff.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {staff.bookings} booking{staff.bookings === 1 ? "" : "s"} in this period
                        </p>
                      </div>
                    </div>
                    <p className="font-mono text-sm font-bold text-foreground">{formatINR(staff.revenue)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </OwnerShell>
  );
}

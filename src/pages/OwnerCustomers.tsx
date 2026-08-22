import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Users, UserPlus, Repeat, UserX, Phone, Calendar, Scissors, IndianRupee } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { OwnerShell } from "@/components/dashboard/OwnerShell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/design/Skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatINR } from "@/lib/currency";
import { toast } from "sonner";

type OwnerRecord = { id: string; name: string; email: string };
type SalonRow = { id: string };

type BookingRow = {
  id: string;
  booking_date: string | null;
  booking_time: string | null;
  status: string | null;
  customer_id: string | null;
  customer_profiles: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    email: string | null;
  } | null;
  services: { name: string; price: number | null } | null;
  barbers: { name: string | null } | null;
};

type Segment = "new" | "returning" | "inactive";

type CustomerVisit = {
  bookingId: string;
  date: string | null;
  time: string | null;
  status: string | null;
  serviceName: string | null;
  price: number | null;
  stylistName: string | null;
};

type CustomerSummary = {
  customerId: string;
  name: string;
  phone: string | null;
  email: string | null;
  totalVisits: number;
  totalSpend: number;
  lastVisit: string | null;
  favoriteService: string | null;
  segment: Segment;
  visits: CustomerVisit[];
};

const COMPLETED_STATUSES = new Set(["done", "completed"]);
const INACTIVE_DAYS_THRESHOLD = 90;

const daysSince = (isoDate: string) => {
  const then = new Date(isoDate).getTime();
  const now = Date.now();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
};

const formatDate = (isoDate: string | null) => {
  if (!isoDate) return "—";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

const formatStatusLabel = (value: string | null) => {
  if (!value) return "—";
  return value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
};

const statusToneClass: Record<string, string> = {
  done: "border-success/20 bg-success/10 text-success",
  completed: "border-success/20 bg-success/10 text-success",
  cancelled: "border-destructive/20 bg-destructive/10 text-destructive",
  rejected: "border-destructive/20 bg-destructive/10 text-destructive",
  waiting: "border-warning/20 bg-warning/10 text-warning",
  pending: "border-warning/20 bg-warning/10 text-warning",
  accepted: "border-primary/20 bg-primary/10 text-primary",
  in_progress: "border-primary/20 bg-primary/10 text-primary",
  in_service: "border-primary/20 bg-primary/10 text-primary",
};

const segmentBadgeClass: Record<Segment, string> = {
  new: "border-primary/20 bg-primary/10 text-primary",
  returning: "border-success/20 bg-success/10 text-success",
  inactive: "border-muted-foreground/20 bg-muted text-muted-foreground",
};

const segmentLabel: Record<Segment, string> = {
  new: "New",
  returning: "Returning",
  inactive: "Inactive",
};

export default function OwnerCustomers() {
  const navigate = useNavigate();
  const supabaseAny = supabase as any;
  const [loading, setLoading] = useState(true);
  const [owner, setOwner] = useState<OwnerRecord | null>(null);
  const [salon, setSalon] = useState<SalonRow | null>(null);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [search, setSearch] = useState("");
  const [segmentFilter, setSegmentFilter] = useState<"all" | Segment>("all");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const raw = localStorage.getItem("owner");
      if (!raw) {
        navigate("/owner-login", { replace: true });
        return;
      }

      try {
        const parsed = JSON.parse(raw) as OwnerRecord;
        setOwner(parsed);

        const { data: salonData, error: salonError } = await supabaseAny
          .from("salons")
          .select("id")
          .eq("owner_id", parsed.id)
          .maybeSingle();

        if (salonError) throw salonError;
        const ownerSalon = (salonData as SalonRow) || null;
        setSalon(ownerSalon);

        if (!ownerSalon) {
          setBookings([]);
          setLoading(false);
          return;
        }

        const { data: bookingsData, error: bookingsError } = await supabaseAny
          .from("bookings")
          .select(`
            id,
            booking_date,
            booking_time,
            status,
            customer_id,
            customer_profiles (id, first_name, last_name, phone, email),
            services (name, price),
            barbers (name)
          `)
          .eq("salon_id", ownerSalon.id)
          .order("booking_date", { ascending: false });

        if (bookingsError) throw bookingsError;
        setBookings((bookingsData as BookingRow[]) || []);
      } catch (error: any) {
        console.error("❌ CUSTOMERS_INIT_ERROR:", error);
        toast.error(error.message || "Failed to load customers");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [navigate]);

  const customers = useMemo<CustomerSummary[]>(() => {
    const byCustomer = new Map<string, BookingRow[]>();

    bookings.forEach((row) => {
      if (!row.customer_id || !row.customer_profiles) return;
      const list = byCustomer.get(row.customer_id) || [];
      list.push(row);
      byCustomer.set(row.customer_id, list);
    });

    const summaries: CustomerSummary[] = [];

    byCustomer.forEach((rows, customerId) => {
      const profile = rows[0].customer_profiles!;
      const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() || profile.phone || "Unnamed Customer";

      const visits: CustomerVisit[] = rows
        .map((row) => ({
          bookingId: row.id,
          date: row.booking_date,
          time: row.booking_time,
          status: row.status,
          serviceName: row.services?.name || null,
          price: row.services?.price ?? null,
          stylistName: row.barbers?.name || null,
        }))
        .sort((a, b) => {
          const aTime = a.date ? new Date(`${a.date}T${a.time || "00:00"}`).getTime() : 0;
          const bTime = b.date ? new Date(`${b.date}T${b.time || "00:00"}`).getTime() : 0;
          return bTime - aTime;
        });

      const totalVisits = rows.length;

      const totalSpend = rows.reduce((sum, row) => {
        const status = (row.status || "").toLowerCase();
        if (!COMPLETED_STATUSES.has(status)) return sum;
        return sum + (row.services?.price || 0);
      }, 0);

      const validDates = rows.map((row) => row.booking_date).filter((d): d is string => !!d).sort();
      const lastVisit = validDates.length > 0 ? validDates[validDates.length - 1] : null;

      const serviceCounts = new Map<string, number>();
      rows.forEach((row) => {
        const svcName = row.services?.name;
        if (!svcName) return;
        serviceCounts.set(svcName, (serviceCounts.get(svcName) || 0) + 1);
      });
      let favoriteService: string | null = null;
      let bestCount = 0;
      serviceCounts.forEach((count, svcName) => {
        if (count > bestCount) {
          bestCount = count;
          favoriteService = svcName;
        }
      });

      const isInactive = lastVisit ? daysSince(lastVisit) >= INACTIVE_DAYS_THRESHOLD : false;
      const segment: Segment = isInactive ? "inactive" : totalVisits === 1 ? "new" : "returning";

      summaries.push({
        customerId,
        name,
        phone: profile.phone,
        email: profile.email,
        totalVisits,
        totalSpend,
        lastVisit,
        favoriteService,
        segment,
        visits,
      });
    });

    return summaries.sort((a, b) => {
      const aTime = a.lastVisit ? new Date(a.lastVisit).getTime() : 0;
      const bTime = b.lastVisit ? new Date(b.lastVisit).getTime() : 0;
      return bTime - aTime;
    });
  }, [bookings]);

  const stats = useMemo(() => {
    const total = customers.length;
    const newCount = customers.filter((c) => c.segment === "new").length;
    const returningCount = customers.filter((c) => c.segment === "returning").length;
    const inactiveCount = customers.filter((c) => c.segment === "inactive").length;
    return { total, newCount, returningCount, inactiveCount };
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return customers.filter((customer) => {
      if (segmentFilter !== "all" && customer.segment !== segmentFilter) return false;
      if (!query) return true;
      const nameMatch = customer.name.toLowerCase().includes(query);
      const phoneMatch = (customer.phone || "").toLowerCase().includes(query);
      return nameMatch || phoneMatch;
    });
  }, [customers, search, segmentFilter]);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.customerId === selectedCustomerId) || null,
    [customers, selectedCustomerId]
  );

  const segmentTabs: { key: "all" | Segment; label: string; count: number }[] = [
    { key: "all", label: "All", count: stats.total },
    { key: "new", label: "New", count: stats.newCount },
    { key: "returning", label: "Returning", count: stats.returningCount },
    { key: "inactive", label: "Inactive", count: stats.inactiveCount },
  ];

  if (loading) {
    return (
      <OwnerShell onLogout={() => { localStorage.removeItem("owner"); navigate("/owner-login", { replace: true }); }}>
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-elevation-1">
            <div className="h-8 w-40 animate-pulse rounded-lg bg-muted" />
            <div className="mt-3 h-4 w-64 animate-pulse rounded-lg bg-muted" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((key) => (
              <div key={key} className="rounded-2xl border border-border bg-card p-5 shadow-elevation-1">
                <Skeleton width="50%" height={12} />
                <div className="mt-2.5">
                  <Skeleton width="35%" height={22} />
                </div>
              </div>
            ))}
          </div>
          <Card className="rounded-2xl border-border bg-card shadow-elevation-1">
            <CardContent className="space-y-3 p-6">
              {[0, 1, 2, 3, 4].map((key) => (
                <Skeleton key={key} height={48} />
              ))}
            </CardContent>
          </Card>
        </div>
      </OwnerShell>
    );
  }

  if (!owner || !salon) return null;

  return (
    <OwnerShell onLogout={() => { localStorage.removeItem("owner"); navigate("/owner-login", { replace: true }); }}>
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-2xl border border-border bg-card p-6 shadow-elevation-1">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">Customers</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your salon's customer directory, derived from booking history.</p>
        </section>

        {bookings.length === 0 ? (
          <Card className="rounded-2xl border-dashed border-border bg-card shadow-none">
            <CardContent className="flex flex-col items-center gap-2 p-12 text-center">
              <Users className="h-8 w-8 text-muted-foreground/50" />
              <p className="font-display text-lg font-bold text-foreground">No customers yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Once bookings start coming in for your salon, customers will show up here automatically.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="rounded-2xl border-border bg-card shadow-elevation-1">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <p className="text-xs font-semibold uppercase tracking-wide">Total Customers</p>
                  </div>
                  <p className="mt-2 font-display text-2xl font-extrabold text-foreground">{stats.total}</p>
                </CardContent>
              </Card>
              <Card className="rounded-2xl border-border bg-card shadow-elevation-1">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <UserPlus className="h-4 w-4" />
                    <p className="text-xs font-semibold uppercase tracking-wide">New (1 visit)</p>
                  </div>
                  <p className="mt-2 font-display text-2xl font-extrabold text-foreground">{stats.newCount}</p>
                </CardContent>
              </Card>
              <Card className="rounded-2xl border-border bg-card shadow-elevation-1">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Repeat className="h-4 w-4" />
                    <p className="text-xs font-semibold uppercase tracking-wide">Returning</p>
                  </div>
                  <p className="mt-2 font-display text-2xl font-extrabold text-foreground">{stats.returningCount}</p>
                </CardContent>
              </Card>
              <Card className="rounded-2xl border-border bg-card shadow-elevation-1">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <UserX className="h-4 w-4" />
                    <p className="text-xs font-semibold uppercase tracking-wide">Inactive (90d+)</p>
                  </div>
                  <p className="mt-2 font-display text-2xl font-extrabold text-foreground">{stats.inactiveCount}</p>
                </CardContent>
              </Card>
            </div>

            <Card className="rounded-2xl border-border bg-card shadow-elevation-1">
              <CardContent className="p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="relative w-full md:max-w-xs">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search by name or phone…"
                      className="pl-9"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {segmentTabs.map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setSegmentFilter(tab.key)}
                        className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                          segmentFilter === tab.key
                            ? "border-primary/30 bg-primary/10 text-primary"
                            : "border-border bg-transparent text-muted-foreground hover:bg-muted/50"
                        }`}
                      >
                        {tab.label} <span className="font-mono opacity-70">({tab.count})</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-6">
                  {filteredCustomers.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                      No customers match your search or filter.
                    </div>
                  ) : (
                    <>
                      {/* Desktop table */}
                      <div className="hidden overflow-hidden rounded-xl border border-border md:block">
                        <div className="grid grid-cols-[1.6fr_1.1fr_0.8fr_1fr_1fr_1.2fr] gap-3 border-b border-border bg-muted/40 px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          <div>Name</div>
                          <div>Phone</div>
                          <div className="text-right">Visits</div>
                          <div className="text-right">Total Spend</div>
                          <div>Last Visit</div>
                          <div>Favorite Service</div>
                        </div>
                        {filteredCustomers.map((customer) => (
                          <button
                            key={customer.customerId}
                            type="button"
                            onClick={() => setSelectedCustomerId(customer.customerId)}
                            className="grid w-full grid-cols-[1.6fr_1.1fr_0.8fr_1fr_1fr_1.2fr] items-center gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/30"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-foreground">{customer.name}</p>
                              <Badge variant="outline" className={`mt-1 rounded-full text-[10px] ${segmentBadgeClass[customer.segment]}`}>
                                {segmentLabel[customer.segment]}
                              </Badge>
                            </div>
                            <div className="truncate text-sm text-muted-foreground">{customer.phone || "—"}</div>
                            <div className="text-right font-mono text-sm text-foreground">{customer.totalVisits}</div>
                            <div className="text-right font-mono text-sm text-foreground">{formatINR(customer.totalSpend)}</div>
                            <div className="text-sm text-muted-foreground">{formatDate(customer.lastVisit)}</div>
                            <div className="truncate text-sm text-muted-foreground">{customer.favoriteService || "—"}</div>
                          </button>
                        ))}
                      </div>

                      {/* Mobile cards */}
                      <div className="space-y-3 md:hidden">
                        {filteredCustomers.map((customer) => (
                          <button
                            key={customer.customerId}
                            type="button"
                            onClick={() => setSelectedCustomerId(customer.customerId)}
                            className="w-full rounded-xl border border-border bg-card p-4 text-left shadow-elevation-1 transition-shadow hover:shadow-elevation-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate font-display text-base font-bold text-foreground">{customer.name}</p>
                                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                                  <Phone className="h-3 w-3" /> {customer.phone || "—"}
                                </p>
                              </div>
                              <Badge variant="outline" className={`shrink-0 rounded-full text-[10px] ${segmentBadgeClass[customer.segment]}`}>
                                {segmentLabel[customer.segment]}
                              </Badge>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <p className="text-muted-foreground">Visits</p>
                                <p className="font-mono font-semibold text-foreground">{customer.totalVisits}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Total Spend</p>
                                <p className="font-mono font-semibold text-foreground">{formatINR(customer.totalSpend)}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Last Visit</p>
                                <p className="font-semibold text-foreground">{formatDate(customer.lastVisit)}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Favorite Service</p>
                                <p className="truncate font-semibold text-foreground">{customer.favoriteService || "—"}</p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Dialog open={!!selectedCustomer} onOpenChange={(open) => !open && setSelectedCustomerId(null)}>
        <DialogContent className="max-w-lg">
          {selectedCustomer ? (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-xl font-bold text-foreground">{selectedCustomer.name}</DialogTitle>
                <DialogDescription>
                  {selectedCustomer.phone || "No phone on file"}
                  {selectedCustomer.email ? ` • ${selectedCustomer.email}` : ""}
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-3 gap-3 rounded-xl border border-border bg-muted/30 p-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Visits</p>
                  <p className="mt-1 font-mono text-lg font-bold text-foreground">{selectedCustomer.totalVisits}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Spend</p>
                  <p className="mt-1 font-mono text-lg font-bold text-foreground">{formatINR(selectedCustomer.totalSpend)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Segment</p>
                  <Badge variant="outline" className={`mt-1 rounded-full text-[10px] ${segmentBadgeClass[selectedCustomer.segment]}`}>
                    {segmentLabel[selectedCustomer.segment]}
                  </Badge>
                </div>
              </div>

              <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Booking History</p>
                {selectedCustomer.visits.map((visit) => {
                  const statusKey = (visit.status || "").toLowerCase();
                  const tone = statusToneClass[statusKey] ?? "border-transparent bg-muted text-muted-foreground";
                  return (
                    <div key={visit.bookingId} className="rounded-xl border border-border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          {formatDate(visit.date)}
                          {visit.time ? <span className="font-normal text-muted-foreground">{visit.time}</span> : null}
                        </div>
                        <Badge variant="outline" className={`rounded-full text-[10px] ${tone}`}>
                          {formatStatusLabel(visit.status)}
                        </Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Scissors className="h-3 w-3" /> {visit.serviceName || "—"}
                        </span>
                        <span>{visit.stylistName || "Any stylist"}</span>
                        <span className="ml-auto flex items-center gap-0.5 font-mono font-semibold text-foreground">
                          <IndianRupee className="h-3 w-3" />
                          {visit.price != null ? visit.price.toLocaleString("en-IN") : "—"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </OwnerShell>
  );
}

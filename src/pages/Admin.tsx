import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock3, Check, X, Loader2, LogOut, TrendingUp, Users2, CalendarDays, ShieldCheck, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";

export default function Admin() {
  const { user, signOut } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBookings = async () => {
    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (error) {
      toast.error("Failed to load bookings");
    } else {
      setBookings(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchBookings();
    
    const channel = supabase
      .channel("admin-bookings")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, fetchBookings)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleUpdateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else toast.success(`Booking ${status}`);
  };

  const stats = useMemo(() => {
    const confirmed = bookings.filter((booking) => booking.status === "confirmed").length;
    const pending = bookings.filter((booking) => booking.status === "pending").length;
    const cancelled = bookings.filter((booking) => booking.status === "cancelled").length;
    return {
      total: bookings.length,
      confirmed,
      pending,
      cancelled,
    };
  }, [bookings]);

  const statusTone = (status: string) => {
    if (status === "confirmed") return "secondary";
    if (status === "cancelled") return "destructive";
    return "outline";
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(79,55,138,0.18),_transparent_34%),radial-gradient(circle_at_85%_16%,_rgba(249,115,22,0.16),_transparent_36%)]" />
      <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="ds-gradient-header flex flex-col gap-4 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-semibold">Admin Dashboard</Badge>
              <span className="text-sm text-muted-foreground">Precision in every second</span>
            </div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Manage queues and track salon performance</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">A premium operational view for bookings, live activity, and business metrics.</p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={signOut} className="rounded-xl">
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="overflow-hidden rounded-xl border-0 bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="rounded-2xl bg-white/20 p-3 text-white"><Users2 className="h-5 w-5" /></div>
                <ArrowUpRight className="h-4 w-4 text-white/80" />
              </div>
              <p className="mt-4 text-3xl font-display font-bold text-white">{stats.total}</p>
              <p className="text-sm text-indigo-100">Total bookings</p>
            </CardContent>
          </Card>
          <Card className="overflow-hidden rounded-xl border-0 bg-gradient-to-br from-sky-500 to-cyan-500 text-white">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="rounded-2xl bg-white/20 p-3 text-white"><CalendarDays className="h-5 w-5" /></div>
                <ArrowUpRight className="h-4 w-4 text-white/80" />
              </div>
              <p className="mt-4 text-3xl font-display font-bold text-white">{stats.pending}</p>
              <p className="text-sm text-cyan-100">Pending approvals</p>
            </CardContent>
          </Card>
          <Card className="overflow-hidden rounded-xl border-0 bg-gradient-to-br from-orange-500 to-amber-500 text-white">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="rounded-2xl bg-white/20 p-3 text-white"><TrendingUp className="h-5 w-5" /></div>
                <ArrowUpRight className="h-4 w-4 text-white/80" />
              </div>
              <p className="mt-4 text-3xl font-display font-bold text-white">{stats.confirmed}</p>
              <p className="text-sm text-orange-100">Confirmed today</p>
            </CardContent>
          </Card>
          <Card className="overflow-hidden rounded-xl border-0 bg-gradient-to-br from-emerald-500 to-teal-500 text-white">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="rounded-2xl bg-white/20 p-3 text-white"><ShieldCheck className="h-5 w-5" /></div>
                <ArrowUpRight className="h-4 w-4 text-white/80" />
              </div>
              <p className="mt-4 text-3xl font-display font-bold text-white">{stats.cancelled}</p>
              <p className="text-sm text-emerald-100">Cancelled</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="bookings" className="mt-6">
          <TabsList className="grid h-auto w-full grid-cols-2 rounded-2xl bg-secondary/40 p-1 sm:w-[420px]">
            <TabsTrigger value="bookings" className="rounded-xl py-2.5">Recent Bookings</TabsTrigger>
            <TabsTrigger value="activity" className="rounded-xl py-2.5">Live Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="bookings" className="mt-6">
            <Card className="rounded-3xl">
              <CardContent className="p-0">
                <div className="border-b bg-muted/40 px-6 py-4">
                  <h2 className="font-display text-xl font-bold">Recent Bookings</h2>
                  <p className="text-sm text-muted-foreground">Review and process customer requests in real time.</p>
                </div>

                {loading ? (
                  <div className="flex py-16 justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : bookings.length === 0 ? (
                  <p className="py-16 text-center text-sm text-muted-foreground">No bookings found.</p>
                ) : (
                  <div className="divide-y divide-border/60">
                    {bookings.map((booking) => (
                      <div key={booking.id} className="flex flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-foreground">{booking.email}</p>
                            <Badge variant={statusTone(booking.status) as any} className="rounded-full capitalize">
                              {booking.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{booking.service} • {booking.booking_date} at {booking.time_slot}</p>
                        </div>

                        <div className="flex items-center gap-2">
                          {booking.status === "pending" && (
                            <>
                              <Button size="sm" onClick={() => handleUpdateStatus(booking.id, "confirmed")} className="rounded-xl">
                                <Check className="mr-1 h-4 w-4" /> Accept
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(booking.id, "cancelled")} className="rounded-xl">
                                <X className="mr-1 h-4 w-4" /> Reject
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="mt-6">
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="rounded-3xl lg:col-span-2">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-display text-xl font-bold">Live Activity</h2>
                      <p className="text-sm text-muted-foreground">A high-level view of bookings, wait times, and salon load.</p>
                    </div>
                    <Clock3 className="h-5 w-5 text-primary" />
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-muted/50 p-4">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">Current Queue</p>
                      <p className="mt-2 font-display text-2xl font-bold">{stats.pending + stats.confirmed}</p>
                    </div>
                    <div className="rounded-2xl bg-muted/50 p-4">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">Average Time</p>
                      <p className="mt-2 font-display text-2xl font-bold">12 min</p>
                    </div>
                    <div className="rounded-2xl bg-muted/50 p-4">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">Peak Window</p>
                      <p className="mt-2 font-display text-2xl font-bold">6 PM</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-3xl">
                <CardContent className="p-6">
                  <h3 className="font-display text-lg font-bold">Quick Notes</h3>
                  <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                    <p>• Keep the next three bookings visible for front desk staff.</p>
                    <p>• Confirm pending bookings before the peak hour.</p>
                    <p>• Use this view to monitor cancellations and accept/reject requests fast.</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


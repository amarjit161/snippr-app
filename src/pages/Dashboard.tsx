import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogOut, Calendar, Clock, Scissors, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Dashboard() {
  const { user, signOut } = useAuth();
  
  const [service, setService] = useState("Haircut");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00 AM");
  const [loading, setLoading] = useState(false);
  
  const [bookings, setBookings] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);

  const fetchBookings = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
      
    if (!error) setBookings(data || []);
    setFetching(false);
  };

  useEffect(() => {
    fetchBookings();
    
    // Listen for realtime booking updates!
    const channel = supabase
      .channel("user-bookings")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `user_id=eq.${user?.id}` }, fetchBookings)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) return toast.error("Please select a date");
    
    setLoading(true);
    const { error } = await supabase.from("bookings").insert({
      user_id: user!.id,
      email: user!.email,
      service,
      booking_date: date,
      booking_time: time
    });
    
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Booking request sent");
      setDate(""); 
    }
  };

  const TIME_SLOTS = ["10:00 AM","11:00 AM","12:00 PM","01:00 PM","02:00 PM","03:00 PM","04:00 PM","05:00 PM","06:00 PM","07:00 PM","08:00 PM"];

  return (
    <div className="min-h-screen bg-[#F9FAFB] p-4 dark:bg-[#09090B] sm:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-2">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Dashboard</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Welcome back, {user?.email}</p>
          </div>
          <Button variant="outline" onClick={signOut} className="text-zinc-600 hover:text-red-600 hover:bg-red-50">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>

        {/* Booking Form Layout */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 mb-4">Book an Appointment</h2>
          <form onSubmit={handleBook} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Service</label>
                <div className="relative">
                  <Scissors className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <select 
                    value={service} 
                    onChange={e => setService(e.target.value)}
                    className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-4 text-sm outline-none transition-all focus:border-zinc-400 focus:ring-4 focus:ring-zinc-900/5 dark:border-zinc-800 dark:bg-zinc-950"
                  >
                    <option>Haircut</option>
                    <option>Beard Trim</option>
                    <option>Facial</option>
                    <option>Haircut + Beard</option>
                  </select>
                </div>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <Input 
                    type="date"
                    required
                    min={new Date().toISOString().split("T")[0]}
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="h-11 rounded-xl bg-zinc-50 pl-10"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Time</label>
                <div className="relative">
                  <Clock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <select 
                    value={time} 
                    onChange={e => setTime(e.target.value)}
                    className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-4 text-sm outline-none transition-all focus:border-zinc-400 focus:ring-4 focus:ring-zinc-900/5 dark:border-zinc-800 dark:bg-zinc-950"
                  >
                    {TIME_SLOTS.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <Button disabled={loading} className="h-11 w-full rounded-xl bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 mt-2">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Book Appointment"}
            </Button>
          </form>
        </div>

        {/* User Bookings */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 mb-4">My Bookings</h2>
          
          {fetching ? (
            <div className="flex py-8 justify-center"><Loader2 className="h-6 w-6 animate-spin text-zinc-400" /></div>
          ) : bookings.length === 0 ? (
            <div className="py-8 text-center text-sm text-zinc-500">You haven't made any bookings yet.</div>
          ) : (
            <div className="space-y-3">
              {bookings.map(b => (
                <div key={b.id} className="flex items-center justify-between rounded-xl border border-zinc-100 p-4 dark:border-zinc-800/60">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-50 dark:bg-zinc-800">
                      <Scissors className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
                    </div>
                    <div>
                      <p className="font-medium text-sm text-zinc-900 dark:text-zinc-50">{b.service}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{b.booking_date} • {b.booking_time}</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 text-xs font-semibold uppercase tracking-wider rounded-full ${
                    b.status === "confirmed" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                    b.status === "cancelled" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                  }`}>
                    {b.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

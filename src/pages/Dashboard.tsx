import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Scissors, Loader2 } from "lucide-react";

export default function Dashboard() {
  const { user, signOut } = useAuth();
  
  const [bookings, setBookings] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);

  const fetchBookings = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("queue")
      .select("*, services (*), salons (*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
      
    if (!error) setBookings(data || []);
    setFetching(false);
  };

  useEffect(() => {
    if (!user) return;
    fetchBookings();
    
    const channel = supabase
      .channel(`user-queue-${user.id}`)
      .on("postgres_changes", { 
        event: "*", 
        schema: "public", 
        table: "queue", 
        filter: `user_id=eq.${user.id}` 
      }, fetchBookings)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

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
                      <p className="font-medium text-sm text-zinc-900 dark:text-zinc-50">{b.services?.name || "Service"}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{b.salons?.name || "Salon"} • {b.booking_date} • {b.booking_time}</p>
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

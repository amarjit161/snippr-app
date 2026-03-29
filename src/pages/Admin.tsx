import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Check, X, Loader2 } from "lucide-react";
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

  return (
    <div className="min-h-screen bg-[#F9FAFB] p-4 dark:bg-[#09090B] sm:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Admin Panel</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Manage all customer bookings in real-time.</p>
          </div>
          <Button variant="outline" onClick={signOut} className="text-zinc-700 hover:text-red-600 hover:bg-red-50">
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">Recent Bookings</h2>
            
            {loading ? (
              <div className="flex py-12 justify-center"><Loader2 className="h-6 w-6 animate-spin text-zinc-400" /></div>
            ) : bookings.length === 0 ? (
              <p className="text-center text-zinc-500 py-8">No bookings found.</p>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {bookings.map((b) => (
                  <div key={b.id} className="flex flex-col sm:flex-row sm:items-center justify-between py-4 gap-4">
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-zinc-50">{b.email}</p>
                      <p className="text-sm text-zinc-500">{b.service} • {b.booking_date} at {b.booking_time}</p>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 text-xs font-semibold uppercase tracking-wider rounded-full ${
                        b.status === "confirmed" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                        b.status === "cancelled" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                        "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                      }`}>
                        {b.status}
                      </span>
                      
                      {b.status === "pending" && (
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleUpdateStatus(b.id, "confirmed")} className="h-8 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900">
                            <Check className="mr-1 h-3.5 w-3.5" /> Accept
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(b.id, "cancelled")} className="h-8 rounded-lg">
                            <X className="mr-1 h-3.5 w-3.5" /> Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

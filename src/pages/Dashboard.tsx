import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import { Loader2, Clock3, MapPin, Scissors, CalendarDays, ChevronLeft } from "lucide-react";

type BookingTab = "upcoming" | "past" | "cancelled";

const toDateLabel = (date?: string) => {
  if (!date) return "Date TBD";
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-IN", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
};

const formatTimeSlot = (timeSlot?: string) => {
  if (!timeSlot) return "Time not set";
  const [h, m] = timeSlot.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return timeSlot;
  const period = h >= 12 ? "PM" : "AM";
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
};

const formatPrice = (amount: number) => `₹${amount.toLocaleString("en-IN")}`;

const isPastDate = (date?: string) => {
  if (!date) return false;
  const today = new Date();
  const nowDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return date < nowDate;
};

export default function Dashboard() {
  const { user, signOut, profile } = useAuth();
  const navigate = useNavigate();
  
  const [bookings, setBookings] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);
  const [activeTab, setActiveTab] = useState<BookingTab>("upcoming");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const status = String(b.status || "").toLowerCase();

      if (activeTab === "cancelled") {
        return ["cancelled", "rejected"].includes(status);
      }

      if (activeTab === "past") {
        return ["done", "completed"].includes(status) || isPastDate(b.booking_date);
      }

      return !["cancelled", "rejected", "done", "completed"].includes(status) && !isPastDate(b.booking_date);
    });
  }, [activeTab, bookings]);

  const cancelBooking = async (id: string) => {
    setUpdatingId(id);
    try {
      const { error } = await supabase
        .from("queue")
        .update({ status: "rejected" } as any)
        .eq("id", id)
        .eq("user_id", user?.id as string);
      if (!error) {
        await fetchBookings();
      }
    } finally {
      setUpdatingId(null);
    }
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
    <div className="min-h-screen bg-[#f4f3f6]">
      <Header
        onSignOut={signOut}
        userName={profile?.name || user?.email || "Customer"}
        userEmail={user?.email || undefined}
        profileName={profile?.name || undefined}
        onAdminToggle={() => navigate("/owner-dashboard")}
      />

      <div className="mx-auto max-w-5xl px-4 pb-12 pt-10 sm:px-6">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center gap-2 text-gray-600 transition-colors hover:text-gray-900"
        >
          <ChevronLeft className="h-5 w-5" />
          <span className="text-sm font-medium">Back</span>
        </button>

        <div className="mb-8">
          <h1 className="font-display text-5xl font-extrabold tracking-tight text-[#121521]">My Bookings</h1>
          <div className="mt-6 flex gap-6 border-b border-[#dfdce4] text-xl font-bold uppercase tracking-[0.08em]">
            {[
              { key: "upcoming", label: "Upcoming" },
              { key: "past", label: "Past" },
              { key: "cancelled", label: "Cancelled" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as BookingTab)}
                className={`pb-3 transition ${
                  activeTab === tab.key
                    ? "border-b-4 border-primary text-primary"
                    : "text-[#6b6474] hover:text-[#373245]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {fetching ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-[#7a43e9]" />
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#d8d4df] bg-white p-12 text-center text-[#6b6474]">
            No bookings in this section.
          </div>
        ) : (
          <div className="space-y-5">
            {filteredBookings.map((b) => {
              const salonName = b.salons?.name || "Salon";
              const serviceName = b.services?.name || "Service";
              const price = b.services?.price || 0;
              const salonImage = b.salons?.image_url || "/default-salon.jpg";
              const status = String(b.status || "pending").toLowerCase();
              const showActions = activeTab === "upcoming";

              return (
                <article key={b.id} className="overflow-hidden rounded-3xl border border-[#e5e2ea] bg-white shadow-sm">
                  <div className="grid gap-0 md:grid-cols-[190px_1fr]">
                    <div className="h-52 w-full overflow-hidden md:h-full">
                      <img src={salonImage} alt={salonName} className="h-full w-full object-cover" />
                    </div>

                    <div className="p-6 sm:p-7">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <h2 className="text-4xl font-extrabold tracking-tight text-[#111525]">{salonName}</h2>
                          <p className="mt-1 text-lg text-[#6b6474]">
                            📍 {[b.salons?.city, b.salons?.address || b.salons?.location].filter(Boolean).join(", ") || "Address unavailable"}
                          </p>
                        </div>
                        <span className="rounded-full bg-[#7a43e9] px-3 py-1 text-sm font-bold text-white">
                          {status === "accepted" || status === "confirmed" ? "Confirmed" : status}
                        </span>
                      </div>

                      <div className="grid gap-4 border-y border-[#ece9f0] py-5 sm:grid-cols-2">
                        <div className="space-y-3">
                          <p className="flex items-center gap-2 text-xl font-semibold text-[#171a27]">
                            <Scissors className="h-5 w-5 text-[#7a43e9]" /> {serviceName}
                          </p>
                          <p className="flex items-center gap-2 text-xl text-[#3d3f49]">
                            <Clock3 className="h-5 w-5 text-[#7a43e9]" /> {formatTimeSlot(b.time_slot || b.booking_time)}
                          </p>
                        </div>

                        <div className="space-y-3">
                          <p className="flex items-center gap-2 text-xl text-[#3d3f49]">
                            <CalendarDays className="h-5 w-5 text-[#7a43e9]" /> {toDateLabel(b.booking_date)}
                          </p>
                          <p className="flex items-center gap-2 text-xl text-[#3d3f49]">
                            <MapPin className="h-5 w-5 text-[#7a43e9]" /> {b.salons?.city || "Location unavailable"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-4xl font-extrabold text-[#7a43e9]">{formatPrice(price)}</p>

                        {showActions ? (
                          <div className="flex gap-3">
                            <Button
                              variant="outline"
                              className="h-11 rounded-full border-rose-300 px-6 text-rose-600 hover:bg-rose-50"
                              disabled={updatingId === b.id}
                              onClick={() => cancelBooking(b.id)}
                            >
                              {updatingId === b.id ? "Cancelling..." : "Cancel"}
                            </Button>
                            <Button
                              className="h-11 rounded-full px-6"
                              onClick={() => navigate(`/salon/${b.salon_id}`)}
                            >
                              Manage
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

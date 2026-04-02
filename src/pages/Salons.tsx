import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import Header from "@/components/Header";
import SalonCard from "@/components/SalonCard";
import QueueTracker from "@/components/QueueTracker";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import type { Tables } from "@/integrations/supabase/types";
import { calculateDistance } from "@/lib/location";
import { useDebounce } from "@/hooks/useDebounce";

export type SalonWithQueueAndDistance = Tables<"salons"> & { queueCount: number; waitTime: number; distance?: number };

const Salons = () => {
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [salons, setSalons] = useState<SalonWithQueueAndDistance[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [userLoc, setUserLoc] = useState<{lat: number, lng: number} | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [selectedCity, setSelectedCity] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationDenied(true);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLoc({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        setLocationDenied(true);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000,
      }
    );
  }, []);

  const fetchSalons = async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const { data: salonData, error: salonError } = await supabase.from("salons").select("*");
      if (salonError) throw salonError;

      const enriched: SalonWithQueueAndDistance[] = await Promise.all(
        (salonData ?? []).map(async (salon) => {
           const { data: queueData, error: queueError } = await supabase
            .from("queue")
            .select("service_id, services(duration)")
            .eq("salon_id", salon.id)
            .eq("status", "waiting");

           if (queueError) {
            console.warn("Queue fetch failed for salon", salon.id, queueError.message);
           }

           const queueCount = queueData?.length ?? 0;
           const waitTime = (queueData ?? []).reduce(
            (sum, e: any) => sum + (e.services?.duration ?? 20), 0
           );

           let dist = undefined;
           if (userLoc && salon.lat && salon.lng) {
               dist = calculateDistance(userLoc.lat, userLoc.lng, salon.lat, salon.lng);
           }

           return { ...salon, queueCount, waitTime, distance: dist };
        })
      );

      // Sort by distance if available
      enriched.sort((a, b) => {
          if (a.distance && b.distance) return a.distance - b.distance;
          return 0;
      });

      setSalons(enriched);
    } catch (error) {
      console.error("Failed to load salons:", error);
      setLoadError("Could not load salons right now. Please try again.");
      setSalons([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalons();
    const channel = supabase
      .channel("salon-queue-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "queue" }, () => fetchSalons())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userLoc]);

  const filteredBySearch = salons.filter(
    (s) =>
      s.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      s.location.toLowerCase().includes(debouncedSearch.toLowerCase())
  );

  const cityOptions = Array.from(
    new Set(
      salons
        .map((salon) => ((salon as any).city as string | null) ?? "")
        .map((city) => city.trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

  const filtered = locationDenied && selectedCity
    ? filteredBySearch.filter((salon) => (((salon as any).city as string | null) ?? "").toLowerCase() === selectedCity.toLowerCase())
    : filteredBySearch;

  const nearYouSalons = filtered
    .filter((salon) => salon.distance !== undefined)
    .slice()
    .sort((a, b) => (a.distance as number) - (b.distance as number));

  if (authLoading || (!user)) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header
        onSignOut={signOut}
        userName={user.email ?? user.phone ?? "User"}
        onAdminToggle={profile?.role === "salon_owner" ? () => navigate("/admin") : undefined}
        isAdmin={false}
      />

      <main className="container space-y-8 pb-32 py-8">
        <div className="space-y-8">
          <section className="ds-gradient-header space-y-2 p-5 sm:p-6">
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Skip the wait.{" "}
              <span className="text-primary">Join the queue.</span>
            </h1>
            <p className="text-muted-foreground max-w-lg">
              Browse salons near you, see live wait times, and join the queue.
            </p>
          </section>

          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search salons or locations…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ds-input pl-10"
            />
          </div>

          {locationDenied ? (
            <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
              <p className="text-sm text-muted-foreground">Location permission is off. Select your city to find nearby salons.</p>
              <div className="mt-3 max-w-sm">
                <select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Select city</option>
                  {cityOptions.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>
            </section>
          ) : null}

          {userLoc && nearYouSalons.length > 0 ? (
            <section className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Near you</h2>
                <p className="text-sm text-muted-foreground">Closest salons based on your current location.</p>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {nearYouSalons.slice(0, 8).map((salon, i) => (
                  <SalonCard key={`near-${salon.id}`} salon={salon as any} index={i} onSelect={() => navigate(`/salon/${salon.id}`)} />
                ))}
              </div>
            </section>
          ) : null}

          <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {loading
              ? [1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-40 rounded-xl bg-gray-200 animate-pulse" />
                ))
              : loadError
              ? <p className="col-span-full rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">{loadError}</p>
              : filtered.length === 0
              ? <p className="col-span-full rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">No salons found for your current search.</p>
              : filtered.map((salon, i) => (
                  <SalonCard key={salon.id} salon={salon as any} index={i} onSelect={() => navigate(`/salon/${salon.id}`)} />
                ))}
          </section>
        </div>
      </main>

      <QueueTracker />
    </div>
  );
};

export default Salons;

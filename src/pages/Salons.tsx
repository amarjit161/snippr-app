import { useState, useEffect, useCallback } from "react";
import { Search } from "lucide-react";
import { publicSupabase } from "@/integrations/supabase/publicClient";
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

type PlaceSuggestion = {
  label: string;
  value: string;
  category: "city" | "salon" | "famous";
  subtitle: string;
};

const INDIA_CITIES = [
  "Delhi",
  "Mumbai",
  "Bengaluru",
  "Hyderabad",
  "Chennai",
  "Kolkata",
  "Pune",
  "Ahmedabad",
  "Jaipur",
  "Surat",
  "Lucknow",
  "Kanpur",
  "Nagpur",
  "Indore",
  "Thane",
  "Bhopal",
  "Visakhapatnam",
  "Patna",
  "Vadodara",
  "Ghaziabad",
  "Ludhiana",
  "Agra",
  "Nashik",
  "Faridabad",
  "Meerut",
  "Rajkot",
  "Varanasi",
  "Srinagar",
  "Aurangabad",
  "Dhanbad",
  "Amritsar",
  "Navi Mumbai",
  "Allahabad",
  "Howrah",
  "Ranchi",
  "Gwalior",
  "Jabalpur",
  "Coimbatore",
  "Vijayawada",
  "Jodhpur",
  "Madurai",
  "Raipur",
  "Kota",
  "Guwahati",
  "Chandigarh",
  "Solapur",
  "Hubballi",
  "Mysuru",
  "Tiruchirappalli",
  "Bareilly",
  "Aligarh",
  "Tiruppur",
  "Moradabad",
  "Jalandhar",
  "Bhubaneswar",
  "Salem",
  "Warangal",
  "Guntur",
  "Bhiwandi",
  "Saharanpur",
  "Gorakhpur",
  "Bikaner",
  "Amravati",
  "Noida",
  "Jamshedpur",
  "Bhilai",
  "Cuttack",
  "Firozabad",
  "Kochi",
  "Nellore",
  "Bhavnagar",
  "Dehradun",
  "Durgapur",
  "Asansol",
  "Rourkela",
  "Nanded",
  "Kolhapur",
  "Ajmer",
  "Akola",
  "Mangalore",
  "Udaipur",
  "Muzaffarpur",
  "Jamnagar",
  "Bokaro",
  "Kozhikode",
  "Kurnool",
  "Tirunelveli",
  "Mathura",
  "Ujjain",
  "Belgaum",
  "Tirupati",
  "Siliguri",
  "Panipat",
  "Sagar",
  "Jammu",
  "Shimla",
];

const FAMOUS_PLACE_SUGGESTIONS: PlaceSuggestion[] = [
  { label: "Connaught Place", value: "Connaught Place", category: "famous", subtitle: "Delhi · central market" },
  { label: "Lajpat Nagar", value: "Lajpat Nagar", category: "famous", subtitle: "Delhi · shopping hub" },
  { label: "Karol Bagh", value: "Karol Bagh", category: "famous", subtitle: "Delhi · salon-heavy area" },
  { label: "Saket", value: "Saket", category: "famous", subtitle: "Delhi · malls and cafes" },
  { label: "Preet Vihar", value: "Preet Vihar", category: "famous", subtitle: "Delhi · East Delhi" },
  { label: "Nirman Vihar", value: "Nirman Vihar", category: "famous", subtitle: "Delhi · metro station" },
  { label: "Rajouri Garden", value: "Rajouri Garden", category: "famous", subtitle: "Delhi · popular retail zone" },
  { label: "Pitampura", value: "Pitampura", category: "famous", subtitle: "Delhi · residential and market area" },
  { label: "Hauz Khas", value: "Hauz Khas", category: "famous", subtitle: "Delhi · premium neighborhood" },
  { label: "Khan Market", value: "Khan Market", category: "famous", subtitle: "Delhi · premium shopping" },
];

const DELHI_LOCALITY_KEYWORDS = [
  "nirman vihar",
  "preet vihar",
  "laxmi nagar",
  "vikas marg",
  "connaught place",
  "karol bagh",
  "lajpat nagar",
  "rajouri garden",
  "hauz khas",
  "pitampura",
  "khan market",
  "saket",
];

const Salons = () => {
  console.log("SALONS_COMPONENT_RENDER_START");
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [salons, setSalons] = useState<SalonWithQueueAndDistance[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [locationMode, setLocationMode] = useState<"auto" | "manual">("auto");
  const [manualCity, setManualCity] = useState("");
  const [userCoords, setUserCoords] = useState<{lat: number, lng: number} | null>(null);
  const [locationError, setLocationError] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  console.log("SALONS_AUTH_STATE:", { 
    userId: user?.id, 
    authLoading, 
    hasProfile: !!profile 
  });

  useEffect(() => {
    if (!authLoading && !user) {
      console.log("SALONS_REDIRECT_TO_AUTH");
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    console.log("SALONS_GEOLOCATION_INIT");
    if (!navigator.geolocation) {
      console.warn("GEOLOCATION_NOT_SUPPORTED");
      setLocationMode("manual");
      setLocationError(true);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log("GEOLOCATION_SUCCESS", position.coords);
        setUserCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationMode("auto");
        setLocationError(false);
      },
      (error) => {
        console.warn("GEOLOCATION_ERROR", error.code, error.message);
        setLocationMode("manual");
        setLocationError(true);
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 300000,
      }
    );
  }, []);

  const fetchSalons = useCallback(async () => {
    console.log("FETCH_SALONS_START_INNER");
    setLoading(true);
    setLoadError(null);

    try {
      const { data: salonData, error: salonError } = await publicSupabase.from("salons").select("*");
      if (salonError) throw salonError;
      console.log("FETCH_SALONS_RAW_DATA", salonData?.length);

      const enriched: SalonWithQueueAndDistance[] = await Promise.all(
        (salonData ?? []).map(async (salon) => {
           // Optimized nested query: only fetch duration from services
           const { data: queueData, error: queueError } = await publicSupabase
            .from("queue")
            .select("services(duration)")
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
             if (userCoords && salon.lat && salon.lng) {
               dist = calculateDistance(userCoords.lat, userCoords.lng, salon.lat, salon.lng);
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
      console.log("FETCH_SALONS_ENRICHED_SUCCESS", enriched.length);
    } catch (error: any) {
      console.error("Failed to load salons:", error);
      setLoadError("Could not load salons right now. Please try again.");
      setSalons([]);
    } finally {
      setLoading(false);
    }
  }, [userCoords]); // Re-fetch only when user coordinates change

  // 1. Initial Fetch on Mount
  useEffect(() => {
    console.log("SALONS_MOUNT_EFFECT");
    fetchSalons();
  }, [fetchSalons]);

  // 2. Real-time Subscriptions for Salon & Queue updates
  useEffect(() => {
    console.log("SALONS_SUBSCRIPTION_INIT");
    const channel = publicSupabase
      .channel("salon-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "queue" }, (payload) => {
        console.log("SALONS_REALTIME: QUEUE_CHANGE_DETECTED");
        fetchSalons();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "salons" }, (payload) => {
        console.log("SALONS_REALTIME: SALON_UPDATE_DETECTED", payload.new?.id);
        // Immediately refetch on salon update
        fetchSalons();
      })
      .subscribe((status) => {
        console.log("SALONS_SUBSCRIPTION_STATUS", status);
      });
    return () => { 
      console.log("SALONS_SUBSCRIPTION_CLEANUP");
      publicSupabase.removeChannel(channel); 
    };
  }, [fetchSalons]);

  // 3. Periodic refresh fallback (every 10 seconds) to ensure latest data
  useEffect(() => {
    console.log("SALONS_PERIODIC_REFRESH_INIT");
    const interval = setInterval(() => {
      console.log("SALONS_PERIODIC_REFRESH_TRIGGERED");
      fetchSalons();
    }, 10000); // 10 seconds

    return () => {
      console.log("SALONS_PERIODIC_REFRESH_CLEANUP");
      clearInterval(interval);
    };
  }, [fetchSalons]);

  const normalizedSearch = debouncedSearch.trim().toLowerCase();
  const isDelhiLocalityQuery =
    normalizedSearch.length > 0 &&
    DELHI_LOCALITY_KEYWORDS.some((keyword) => normalizedSearch.includes(keyword));

  const filteredBySearch = salons.filter((s) => {
    const city = (((s as any).city as string | null) ?? "").toLowerCase();
    const pincode = String((s as any).pincode ?? "").toLowerCase();
    const directMatch =
      s.name.toLowerCase().includes(normalizedSearch) ||
      (s.location || "").toLowerCase().includes(normalizedSearch) ||
      city.includes(normalizedSearch) ||
      (s.address || "").toLowerCase().includes(normalizedSearch) ||
      pincode.includes(normalizedSearch);

    if (!normalizedSearch) return true;
    if (directMatch) return true;

    // Landmark fallback: if user searches a well-known Delhi locality,
    // include Delhi salons to behave more like ride/food apps.
    if (isDelhiLocalityQuery && city === "delhi") {
      return true;
    }

    return false;
  });

  const suggestionQuery = normalizedSearch;
  const placeSuggestions: PlaceSuggestion[] = suggestionQuery
    ? [
        ...INDIA_CITIES.filter((city) => city.toLowerCase().includes(suggestionQuery))
          .slice(0, 6)
          .map((city) => ({
            label: city,
            value: city,
            category: "city" as const,
            subtitle: "City suggestion",
          })),
        ...salons
          .filter((salon) =>
            [
              salon.name,
              salon.address,
              (salon as any).city,
              salon.location,
              String((salon as any).pincode ?? ""),
            ]
              .filter(Boolean)
              .some((field) => String(field).toLowerCase().includes(suggestionQuery))
          )
          .slice(0, 6)
          .map((salon) => ({
            label: salon.name,
            value: salon.name,
            category: "salon" as const,
            subtitle:
              salon.address ||
              ((salon as any).city
                ? `${(salon as any).city} · salon`
                : "Salon result"),
          })),
        ...FAMOUS_PLACE_SUGGESTIONS.filter((item) =>
          item.label.toLowerCase().includes(suggestionQuery) ||
          item.subtitle.toLowerCase().includes(suggestionQuery)
        ).slice(0, 6),
      ]
    : FAMOUS_PLACE_SUGGESTIONS.slice(0, 6);

  const uniqueSuggestions = Array.from(
    new Map(placeSuggestions.map((item) => [item.label.toLowerCase(), item])).values()
  ).slice(0, 8);

  const cityOptions = Array.from(
    new Set([
      ...INDIA_CITIES,
      ...salons
        .map((salon) => ((salon as any).city as string | null) ?? "")
        .map((city) => city.trim())
        .filter(Boolean),
    ])
  ).sort((a, b) => a.localeCompare(b));

  const filtered = filteredBySearch.filter((salon) => {
    const city = (((salon as any).city as string | null) ?? "").toLowerCase();
    const matchesCity =
      locationMode === "auto" ||
      !manualCity ||
      city === manualCity.toLowerCase();
    return matchesCity;
  });

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
        userEmail={user.email || undefined}
        profileName={profile?.name || undefined}
        onAdminToggle={profile ? () => navigate("/owner-dashboard") : undefined}
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

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search salons, landmarks, addresses…"
                value={search}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setShowSuggestions(true);
                }}
                className="ds-input pl-10"
              />
              {showSuggestions && uniqueSuggestions.length > 0 ? (
                <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-border bg-background shadow-xl">
                  <div className="border-b border-border px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Search suggestions
                    </p>
                  </div>
                  <div className="max-h-80 overflow-auto py-2">
                    {uniqueSuggestions.map((item) => (
                      <button
                        key={`${item.category}-${item.label}`}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setSearch(item.value);
                          if (item.category === "city") {
                            setManualCity(item.value);
                            setLocationMode("manual");
                          } else if (!locationError) {
                            setManualCity("");
                            setLocationMode("auto");
                          }
                          setShowSuggestions(false);
                        }}
                        className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-muted/70"
                      >
                        <div className="mt-0.5 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-primary">
                          {item.category}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">{item.label}</p>
                          <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-3">
                <div
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium ${
                    locationMode === "auto"
                      ? "bg-green-100 text-green-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  <span>{locationMode === "auto" ? "📍" : "⚠️"}</span>
                  <span>{locationMode === "auto" ? "Using current location" : "Location unavailable"}</span>
                </div>

                <select
                  value={manualCity}
                  onChange={(e) => {
                    setManualCity(e.target.value);
                    setLocationMode("manual");
                  }}
                  className="h-10 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-primary/40"
                >
                  <option value="">All cities</option>
                  {cityOptions.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>

                {locationMode === "manual" && manualCity ? (
                  <button
                    type="button"
                    onClick={() => {
                      setManualCity("");
                      setLocationMode("auto");
                    }}
                    className="rounded-xl bg-primary/10 px-3 py-2 text-sm font-medium text-primary"
                  >
                    Reset
                  </button>
                ) : null}
              </div>
              {locationError ? (
                <p className="text-xs text-muted-foreground">
                  Auto location is unavailable right now. Use manual city selection to filter salons.
                </p>
              ) : null}
            </section>
          </div>

          {userCoords && nearYouSalons.length > 0 ? (
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

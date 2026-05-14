import { useState, useEffect } from "react";
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
import { useGeolocation } from "@/hooks/useGeolocation";
import { useQuery, useQueryClient } from "@tanstack/react-query";

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
  const { location: userCoords } = useGeolocation();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"distance" | "waitTime">("distance");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [manualCity, setManualCity] = useState("");
  const [locationMode, setLocationMode] = useState<"auto" | "manual">("auto");
  const [locationError, setLocationError] = useState(false);
  const debouncedSearch = useDebounce(search, 300);
  const queryClient = useQueryClient();
  const { data: salons = [], isLoading: loading, error: queryError } = useQuery({
    queryKey: ["salons", userCoords],
    queryFn: async () => {
      console.log("FETCH_SALONS_OPTIMIZED_START");
      const { data, error } = await publicSupabase
        .from("salon_with_stats" as any)
        .select("*");

      if (error) throw error;

      return (data as any[]).map(salon => {
        let dist = undefined;
        if (userCoords && salon.lat && salon.lng) {
          dist = calculateDistance(userCoords.lat, userCoords.lng, salon.lat, salon.lng);
        }
        return { ...salon, distance: dist };
      }).sort((a, b) => {
        if (a.distance && b.distance) return a.distance - b.distance;
        return 0;
      });
    },
    enabled: !!user,
    refetchInterval: 5 * 60 * 1000,
  });

  const loadError = queryError ? "Could not load salons right now." : null;

  // Real-time Subscriptions for Salon updates (not all queue changes)
  useEffect(() => {
    if (!user) return;
    
    console.log("SALONS_SUBSCRIPTION_INIT");
    const channel = publicSupabase
      .channel("salon-updates-v2")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "salons" }, () => {
        console.log("SALONS_REALTIME: SALON_UPDATE_DETECTED");
        queryClient.invalidateQueries({ queryKey: ["salons"] });
      })
      .subscribe();
      
    return () => { 
      publicSupabase.removeChannel(channel); 
    };
  }, [user, queryClient]);

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
    .sort((a, b) => {
      if (sortBy === "distance") {
        return (a.distance as number) - (b.distance as number);
      } else {
        return (a.waitTime || 0) - (b.waitTime || 0);
      }
    });

  const sortedFiltered = filtered.slice().sort((a, b) => {
    if (sortBy === "distance") {
      return (a.distance || 0) - (b.distance || 0);
    } else {
      return (a.waitTime || 0) - (b.waitTime || 0);
    }
  });

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

      <main className="max-w-7xl mx-auto px-6 pt-12 pb-32">
        <div className="space-y-8">
          {/* Header Section */}
          <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <span className="font-headline font-bold text-xs uppercase tracking-widest text-[#630ed4] mb-2 block">
                Nearby Artisans
              </span>
              <h1 className="font-headline font-extrabold text-4xl tracking-tight text-[#191c1d]">
                Explore Salons
              </h1>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setSortBy("distance")}
                className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-colors ${
                  sortBy === "distance" 
                    ? "bg-[#630ed4] text-white shadow-lg shadow-[#630ed4]/20" 
                    : "bg-white text-[#191c1d] shadow-sm border border-[#ccc3d8]/10 hover:bg-[#f3f4f5]"
                }`}
              >
                Distance
              </button>
              <button 
                onClick={() => setSortBy("waitTime")}
                className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-colors ${
                  sortBy === "waitTime" 
                    ? "bg-[#630ed4] text-white shadow-lg shadow-[#630ed4]/20" 
                    : "bg-white text-[#191c1d] shadow-sm border border-[#ccc3d8]/10 hover:bg-[#f3f4f5]"
                }`}
              >
                Wait Time
              </button>
            </div>
          </header>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="relative">
              <div className="flex items-center bg-[#e7e8e9] rounded-full px-4 py-3 border border-[#ccc3d8]/15 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#630ed4]/20 transition-all">
                <Search className="text-[#4a4455] mr-2 w-5 h-5" />
                <Input
                  placeholder="Search salons, landmarks, addresses…"
                  value={search}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setShowSuggestions(true);
                  }}
                  className="bg-transparent border-none focus:ring-0 focus-visible:ring-0 text-sm w-full font-medium placeholder:text-[#4a4455]/60 shadow-none px-0"
                />
              </div>
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

          <section className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {loading
              ? [1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-40 rounded-xl bg-gray-200 animate-pulse" />
                ))
              : loadError
              ? <p className="col-span-full rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">{loadError}</p>
              : sortedFiltered.length === 0
              ? <p className="col-span-full rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">No salons found for your current search.</p>
              : sortedFiltered.map((salon, i) => (
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


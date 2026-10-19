import { useState, useEffect, useMemo, useRef } from "react";
import { ChevronDown, Search, List as ListIcon, LocateFixed, Map as MapIcon, MapPin, SlidersHorizontal, X } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { publicSupabase } from "@/integrations/supabase/publicClient";
import { Input } from "@/components/ui/input";
import Header from "@/components/Header";
import SalonCard from "@/components/SalonCard";
import QueueTracker from "@/components/QueueTracker";
import { ErrorState } from "@/components/design/ErrorState";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import type { Tables } from "@/integrations/supabase/types";
import { distanceToSalonKm } from "@/lib/location";
import { demoLocationMode, reportDemoLocations } from "@/lib/demoLocations";
import { COARSE_ACCURACY_METRES, locationQualityOf } from "@/lib/salonLocation";
import { getStartingPrices, nearestSalon, sortSalons, type DiscoverySort } from "@/lib/salonDiscovery";
import {
  EMPTY_FILTERS,
  activeFilterChips,
  applyDiscoveryFilters,
  categoriesBySalon,
  countActiveFilters,
  filterOptionCounts,
  salonCategoryLabels,
  toggleIn,
  type DiscoveryFilterState,
  type ServiceCategoryId,
} from "@/lib/salonFilters";
import { FilterSheet } from "@/components/salons/FilterSheet";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import SalonMapPanel, { MapNotice, MapSkeleton } from "@/components/salons/SalonMapPanel";
import SalonMapPreview from "@/components/salons/SalonMapPreview";
import { CityPicker } from "@/components/salons/CityPicker";
import {
  REVERSE_GEOCODE_ATTRIBUTION,
  salonMapFallbackView,
  matchSalonCity,
  normalizeCity,
  reverseGeocodeCity,
  salonCityOptions,
} from "@/lib/cityLocation";
import {
  cityAutoDetectAttempted,
  geolocationAvailability,
  markCityAutoDetectAttempted,
  readSessionCity,
  writeSessionCity,
  type SessionCityChoice,
} from "@/lib/citySession";
import { useDebounce } from "@/hooks/useDebounce";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePageMeta } from "@/hooks/usePageMeta";
import { appCanonicalOrigin } from "@/lib/domains";

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

// /salons content width: fluid ~94% of large screens, capped at 1600px; masthead,
// filters, results and map all share these edges.
const PAGE_CONTAINER = "mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:w-[94%] lg:px-0";

const SORT_OPTIONS: { value: DiscoverySort; label: string }[] = [
  { value: "recommended", label: "Recommended" },
  { value: "distance", label: "Nearest" },
  { value: "wait", label: "Wait time" },
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
  const routerLocation = useLocation();
  const searchInputRef = useRef<HTMLInputElement>(null);
  // userCoords is the device's real position or null (never a substitute location —
  // not a city centre, the map's default view or a demo coordinate). Asked for by the
  // first-visit city detection, "Detect my city", "Nearest" or the map's "Show my
  // location". A recent reading is remembered in memory only (never storage), so coming
  // back to /salons within the app keeps the customer's marker and distances without
  // asking again; a reload forgets it.
  const {
    location: userCoords,
    status: geoStatus,
    error: geoError,
    request: requestLocation,
    accuracy: geoAccuracy,
  } = useGeolocation({ enabled: false, remember: true });
  // A coarse device reading (e.g. Wi-Fi only) only supports approximate distances.
  const coarseLocation = !!userCoords && geoAccuracy !== null && geoAccuracy > COARSE_ACCURACY_METRES;

  usePageMeta({
    title: "Find a Salon — Snippr",
    description: "Browse salons on Snippr, compare live queues and wait times, and book your appointment.",
    canonical: `${appCanonicalOrigin()}/salons`,
  });
  const [search, setSearch] = useState("");
  // "Recommended" (API order) until the customer shares a location; then nearest
  // first by default — unless they already picked a sort themselves.
  const [sortBy, setSortBy] = useState<DiscoverySort>("recommended");
  const [sortChosen, setSortChosen] = useState(false);
  // Pressing "Nearest" without a location is the explicit request for one.
  const [nearestRequested, setNearestRequested] = useState(false);
  // One filter state for every screen size (quick chips and the "All filters" sheet).
  const [filters, setFilters] = useState<DiscoveryFilterState>(EMPTY_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);
  const allFiltersRef = useRef<HTMLButtonElement>(null);
  // Desktop (lg+): search sits in the header and the filter sidebar is always shown.
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  // Phones: a shorter search placeholder that isn't cut off.
  const isNarrow = useMediaQuery("(max-width: 639px)");
  // List-first: the map is an optional secondary view.
  const [view, setView] = useState<"list" | "map">("list");
  const [selectedSalonId, setSelectedSalonId] = useState<string | null>(null);
  const reducedMotion = useReducedMotion() ?? false;
  const [showSuggestions, setShowSuggestions] = useState(false);
  // The city the list is filtered to: detected from the device or picked. Remembered
  // for this tab session (the city only — never coordinates), so returning to /salons
  // doesn't ask again or lose the customer's choice.
  const [cityChoice, setCityChoice] = useState<SessionCityChoice | null>(() => readSessionCity());
  useEffect(() => writeSessionCity(cityChoice), [cityChoice]);
  const [detection, setDetection] = useState<
    "idle" | "locating" | "resolving" | "unresolved" | "denied" | "failed" | "unsupported" | "insecure"
  >("idle");
  const [pickerOpen, setPickerOpen] = useState(false);
  const cityTriggerRef = useRef<HTMLButtonElement>(null);
  // Each detection gets a token; choosing a city manually invalidates it, so a late
  // GPS fix or city lookup can never overwrite the user's choice.
  const detectTokenRef = useRef(0);
  const lookupAbortRef = useRef<AbortController | null>(null);
  const detecting = detection === "locating" || detection === "resolving";

  const handleDetectCity = () => {
    // One request at a time: a second press while the browser is still answering does nothing.
    if (detecting) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setDetection("unsupported");
      return;
    }
    if (typeof window !== "undefined" && window.isSecureContext === false) {
      setDetection("insecure");
      return;
    }
    detectTokenRef.current += 1;
    lookupAbortRef.current?.abort();
    setDetection("locating");
    requestLocation();
  };

  // First visit in this tab session: try to find the customer's city once, unless they
  // already have one. A permission granted earlier answers silently; an undecided one
  // shows the browser's own prompt (once); a denied one isn't asked again. The ref
  // keeps React Strict Mode's double effect from asking twice; the session flag keeps
  // re-renders, refetches and route changes from asking again.
  const autoDetectStartedRef = useRef(false);
  useEffect(() => {
    if (autoDetectStartedRef.current) return;
    autoDetectStartedRef.current = true;
    if (cityChoice || cityAutoDetectAttempted()) return;
    markCityAutoDetectAttempted();
    const token = detectTokenRef.current;
    void geolocationAvailability().then((availability) => {
      // The customer picked a city (or pressed Detect) meanwhile: leave it alone.
      if (detectTokenRef.current !== token) return;
      if (availability === "unsupported") setDetection("unsupported");
      else if (availability === "insecure") setDetection("insecure");
      else if (availability === "denied") setDetection("denied");
      else handleDetectCity();
    });
    // Runs once per mount by design (guarded above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chooseCity = (city: string | null) => {
    detectTokenRef.current += 1;
    lookupAbortRef.current?.abort();
    if (detecting) setDetection("idle");
    setCityChoice(city ? { source: "manual", name: city } : null);
  };

  useEffect(() => {
    if (detection !== "locating") return;
    if (geoStatus === "located" && userCoords) {
      const token = detectTokenRef.current;
      const controller = new AbortController();
      lookupAbortRef.current = controller;
      setDetection("resolving");
      reverseGeocodeCity(userCoords.lat, userCoords.lng, { signal: controller.signal })
        .then((place) => {
          if (detectTokenRef.current !== token) return;
          if (!place) {
            setDetection("unresolved");
            return;
          }
          setCityChoice({ source: "detected", place });
          setDetection("idle");
        })
        .catch(() => {
          if (detectTokenRef.current === token) setDetection("unresolved");
        });
    } else if (geoStatus === "unavailable") {
      // A denial is remembered: no further prompts unless the user changes browser settings.
      setDetection(geoError === "Location permission denied" ? "denied" : "failed");
    }
  }, [detection, geoStatus, userCoords, geoError]);

  useEffect(() => () => lookupAbortRef.current?.abort(), []);

  // "Show my location" on the map: a fresh reading on each press (one at a time — a press
  // while the browser is answering does nothing), then the map centres on it. Problems are
  // explained over the map; the city choice is never touched.
  const [locateRequested, setLocateRequested] = useState(false);
  const [locateInsecure, setLocateInsecure] = useState(false);
  const [locationMessageDismissed, setLocationMessageDismissed] = useState(false);
  const awaitingLocateRef = useRef(false);
  const handleLocateMe = () => {
    if (geoStatus === "pending") return;
    setLocationMessageDismissed(false);
    setLocateRequested(true);
    if (typeof window !== "undefined" && window.isSecureContext === false) {
      setLocateInsecure(true);
      return;
    }
    awaitingLocateRef.current = true;
    requestLocation();
  };
  // Centre the map on the customer when their position is first obtained on this page,
  // and after each "Show my location" — once each, so later panning/zooming is theirs.
  const [centreOnUser, setCentreOnUser] = useState(false);
  const centredOnceRef = useRef(false);
  useEffect(() => {
    if (!userCoords) return;
    if (!centredOnceRef.current || awaitingLocateRef.current) setCentreOnUser(true);
    centredOnceRef.current = true;
    awaitingLocateRef.current = false;
    // A position now works: an earlier "blocked"/"failed" city note no longer applies.
    setDetection((d) => (d === "denied" || d === "failed" ? "idle" : d));
  }, [userCoords]);
  const locationMessage =
    locationMessageDismissed || !locateRequested
      ? null
      : locateInsecure
      ? "Location only works on a secure (https) connection. You can still choose your city."
      : geoStatus !== "unavailable"
      ? null
      : geoError === "Location permission denied"
      ? "Location is blocked for this site. To show where you are, allow Location for this site in your browser's site settings (the icon beside the address bar), then press “Show my location” again. You can still choose your city."
      : geoError === "Location request timed out"
      ? "Finding your location took too long. Press “Show my location” to try again."
      : geoError === "Geolocation not supported"
      ? "This browser can't share your location. Choose your city instead."
      : "Your device couldn't find your location right now. Try again in a moment, or choose your city.";
  const debouncedSearch = useDebounce(search, 300);
  const queryClient = useQueryClient();

  useEffect(() => {
    if ((routerLocation.state as { focusSearch?: boolean } | null)?.focusSearch) {
      searchInputRef.current?.focus();
    }
  }, [routerLocation.state]);
  const { data: salonRows = [], isLoading: loading, error: queryError } = useQuery({
    queryKey: ["salons"],
    queryFn: async () => {
      console.log("FETCH_SALONS_OPTIMIZED_START");
      // publicSupabase: salon discovery must work for anonymous visitors too (public SEO pages).
      const { data, error } = await publicSupabase
        .from("salon_with_stats" as any)
        .select("*");

      if (error) throw error;

      // Demo coordinates for the test salons (src/dev/testSalonLocations.ts): on the
      // dev server, or in a build made with VITE_DEMO_SALON_LOCATIONS=true (Preview
      // only — see lib/demoLocations.ts), never on a production domain. Both checks
      // are build-time constants, so an ordinary production build drops the import and
      // ships no fixture data. Nothing is written anywhere; the UI labels them as demo.
      const rows =
        ((import.meta.env.DEV && import.meta.env.MODE !== "test") || import.meta.env.VITE_DEMO_SALON_LOCATIONS === "true") &&
        demoLocationMode({
          devServer: import.meta.env.DEV && import.meta.env.MODE !== "test",
          demoBuild: import.meta.env.VITE_DEMO_SALON_LOCATIONS === "true",
          hostname: window.location.hostname,
        })
          ? reportDemoLocations((await import("@/dev/testSalonLocations")).withTestLocations(data as any[], true))
          : (data as any[]);
      // API order is the "Recommended" order; sorting happens in sortSalons.
      return rows.map((salon) => ({
        ...salon,
        queueCount: salon.queue_count,
        waitTime: salon.wait_time,
        // salon_with_stats exposes latitude/longitude (not lat/lng).
        locationQuality: locationQualityOf(salon),
      }));
    },
    enabled: !authLoading,
    refetchInterval: 5 * 60 * 1000,
    placeholderData: (previous) => previous,
  });
  // Straight-line distances from the customer's real position, worked out here (not in
  // the query): a new reading needs no refetch, and the distances — and so the nearest
  // salon — are ready in the same render as the position. No position or no salon
  // coordinates → no distance (never a guess).
  const salons = useMemo(
    () => salonRows.map((salon) => ({ ...salon, distance: distanceToSalonKm(userCoords, salon) })),
    [salonRows, userCoords],
  );

  const loadError = queryError ? "Could not load salons right now." : null;

  // Nearest needs the customer's real position and at least one salon with a
  // location; never pretend otherwise (salons without one stay in the list, last).
  const anyDistance = salons.some((s) => typeof s.distance === "number" && Number.isFinite(s.distance));
  const nearestAvailable = !!userCoords && anyDistance;
  // Every calculable distance comes from a demo/test coordinate: the ranking is demo-only.
  const distancesAllDemo =
    anyDistance &&
    salons.every((s) => !(typeof s.distance === "number" && Number.isFinite(s.distance)) || !!(s as { locationDemo?: unknown }).locationDemo);
  useEffect(() => {
    if (nearestAvailable && !sortChosen) setSortBy("distance");
  }, [nearestAvailable, sortChosen]);
  const effectiveSort: DiscoverySort = sortBy === "distance" && !nearestAvailable ? "recommended" : sortBy;
  const sortNote =
    nearestRequested && geoStatus === "pending"
      ? "Finding your location…"
      : nearestRequested && geoStatus === "unavailable"
      ? geoError === "Location permission denied"
        ? "Location access is blocked, so salons are in recommended order. Allow location in your browser settings to sort nearest first."
        : `${geoError ?? "Location unavailable"}, so salons are in recommended order. Choose Nearest to try again.`
      : userCoords && !anyDistance
      ? "None of these salons has a map location yet, so they can't be sorted by distance."
      : effectiveSort === "distance" && distancesAllDemo
      ? "Sorted by straight-line distance to demo salon locations (not verified) — for trying out the map only."
      : !userCoords && effectiveSort === "recommended"
      ? "Nearest asks for your location first."
      : null;

  // Services: one batched read of public services (no request per salon), giving
  // each salon's starting price (getStartingPrices ignores missing/invalid prices)
  // and its service categories (from real service names). Ordered cheapest first
  // (unpriced last) so that, if the API ever caps the row count, every salon that
  // is present still gets its true minimum. While loading or on error both are
  // empty: cards show no price/services and service/price filters offer nothing.
  const { data: serviceData } = useQuery({
    queryKey: ["salon-services-summary"],
    queryFn: async () => {
      const { data, error } = await publicSupabase
        .from("services")
        .select("salon_id, name, price")
        .order("price", { ascending: true });
      if (error) throw error;
      return { startingPrices: getStartingPrices(data), categories: categoriesBySalon(data) };
    },
    enabled: !authLoading,
    refetchInterval: 5 * 60 * 1000,
  });
  const startingPrices = serviceData?.startingPrices;
  const withStartingPrice = <T extends { id: string }>(salon: T) => ({
    ...salon,
    startingPrice: startingPrices?.get(salon.id) ?? null,
    serviceLabels: salonCategoryLabels(serviceData?.categories.get(salon.id)),
    // Demo fixtures and approximate positions are locality-level: distances are rounded ("≈").
    ...withDistanceInfo(salon),
  });
  // Distance presentation shared by the cards, the map and its preview.
  const withDistanceInfo = <T extends { id: string }>(salon: T) => ({
    // Demo fixtures and approximate positions are locality-level: distances are rounded ("≈").
    distanceApproximate:
      coarseLocation || ["approximate", "demo"].includes((salon as { locationQuality?: string }).locationQuality ?? ""),
    flagMissingLocation: !!userCoords,
    isNearest: salon.id === nearestId,
  });

  const { data: favoriteIds = [] } = useQuery({
    queryKey: ["favorite-salon-ids", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_favorite_salons")
        .select("salon_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((row) => row.salon_id);
    },
    enabled: !!user,
  });

  const favoriteIdSet = new Set(favoriteIds);

  const handleToggleFavorite = async (salon: Tables<"salons">) => {
    if (!user) return;
    const isFavorited = favoriteIdSet.has(salon.id);

    // Optimistic update
    queryClient.setQueryData<string[]>(["favorite-salon-ids", user.id], (prev = []) =>
      isFavorited ? prev.filter((id) => id !== salon.id) : [...prev, salon.id]
    );

    try {
      if (isFavorited) {
        const { error } = await supabase
          .from("customer_favorite_salons")
          .delete()
          .eq("user_id", user.id)
          .eq("salon_id", salon.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("customer_favorite_salons")
          .insert({ user_id: user.id, salon_id: salon.id });
        if (error) throw error;
      }
    } catch (err) {
      console.error("FAVORITE_TOGGLE_ERROR", err);
      // Revert optimistic update on failure
      queryClient.invalidateQueries({ queryKey: ["favorite-salon-ids", user.id] });
    }
  };

  // Real-time Subscriptions for Salon updates (not all queue changes).
  // Uses publicSupabase already, so this works for anonymous visitors too.
  useEffect(() => {
    console.log("SALONS_SUBSCRIPTION_INIT");
    let channel: any = null;
    
    try {
      channel = publicSupabase
        .channel("salon-updates-v2")
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "salons" }, () => {
          console.log("SALONS_REALTIME: SALON_UPDATE_DETECTED");
          queryClient.invalidateQueries({ queryKey: ["salons"] });
        })
        .subscribe((status: any) => {
          console.log("SALONS_SUBSCRIPTION_STATUS", status);
        });
    } catch (err) {
      console.error("SALONS_SUBSCRIPTION_ERROR", err);
    }
      
    return () => { 
      if (channel) {
        try {
          publicSupabase.removeChannel(channel);
          console.log("SALONS_SUBSCRIPTION_CLEANUP_SUCCESS");
        } catch (err) {
          console.error("SALONS_SUBSCRIPTION_CLEANUP_ERROR", err);
        }
      }
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
              salon?.name,
              salon?.address,
              (salon as any)?.city,
              salon?.location,
              String((salon as any)?.pincode ?? ""),
            ]
              .filter(Boolean)
              .some((field) => String(field).toLowerCase().includes(suggestionQuery))
          )
          .slice(0, 6)
          .map((salon) => ({
            label: salon?.name ?? "Salon",
            value: salon?.name ?? "Salon",
            category: "salon" as const,
            subtitle:
              salon?.address ||
              ((salon as any)?.city
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

  // Real cities from salon data (null while loading/failed, so nothing is claimed).
  // Salons whose city value is a state name, a placeholder or missing aren't turned
  // into city options; they remain in the list whenever no city filter is applied.
  const cityOptionsData = loading || loadError ? null : salonCityOptions(salons as { city?: string | null }[]);
  const cityCounts = cityOptionsData?.cities ?? null;
  const matchedDetectedCity =
    cityChoice?.source === "detected" ? matchSalonCity(cityChoice.place, (cityCounts ?? []).map((c) => c.name)) : null;
  const filterCity =
    cityChoice?.source === "manual"
      ? cityChoice.name
      : cityChoice?.source === "detected"
      ? matchedDetectedCity ?? cityChoice.place.city
      : null;
  const cityLabel =
    cityChoice?.source === "detected"
      ? [cityChoice.place.city, cityChoice.place.country].filter(Boolean).join(", ")
      : cityChoice?.source === "manual"
      ? cityChoice.name
      : null;

  const filtered = filteredBySearch.filter(
    (salon) => !filterCity || normalizeCity((salon as any).city as string | null) === normalizeCity(filterCity),
  );

  // Stage 2 discovery rules: "Open now" / "Short wait" filters, then a stable sort
  // (recommended: API order; distance: unknown distances last; wait: open with a
  // known wait first, closed last).
  const filterCtx = { categories: serviceData?.categories ?? new Map<string, Set<ServiceCategoryId>>(), startingPrices };
  const sortedFiltered = sortSalons(applyDiscoveryFilters(filtered, filters, filterCtx), effectiveSort);
  // The closest of the shown salons to the customer's real position, by calculated
  // distance — none without a position, or when no shown salon has coordinates.
  const nearestId = userCoords ? nearestSalon(sortedFiltered)?.salon.id ?? null : null;
  // Options are counted on the city + search results, and only offered when they match salons.
  const filterOptions = filterOptionCounts(filtered, filterCtx);
  const quickCategories = [...filterOptions.categories].sort((a, b) => b.count - a.count).slice(0, 3);
  const appliedChips = activeFilterChips(filters);

  // A selection only counts while that salon is still in the visible results.
  const selectedSalon = sortedFiltered.find((salon) => salon.id === selectedSalonId) ?? null;
  const activeFilterCount = countActiveFilters(filters);

  // Desktop map view: results list (left) beside a sticky map (right). Narrower
  // screens keep the full-width map, with the selection previewed on the map.
  const splitMap = isDesktop && view === "map";

  // Choosing a pin brings that salon's card in the side list into view once it has
  // rendered. Only a pin choice scrolls — switching views or "Show on map" does not.
  const scrollToSelectionRef = useRef(false);
  const handleMarkerSelect = (id: string) => {
    scrollToSelectionRef.current = true;
    setSelectedSalonId(id);
  };
  useEffect(() => {
    if (!scrollToSelectionRef.current) return;
    scrollToSelectionRef.current = false;
    if (!splitMap || !selectedSalonId) return;
    document
      .getElementById(`salon-card-${selectedSalonId}`)
      ?.scrollIntoView?.({ behavior: reducedMotion ? "auto" : "smooth", block: "nearest" });
  }, [selectedSalonId, reducedMotion, splitMap]);

  const renderSalonCard = (salon: (typeof sortedFiltered)[number], i: number) => (
    <div
      key={salon.id}
      id={`salon-card-${salon.id}`}
      data-testid="salon-card"
      data-selected={salon.id === selectedSalon?.id ? "true" : undefined}
      // Scrolled into view above the fixed bottom navigation on phones.
      className={`h-full scroll-mt-24 rounded-2xl max-md:scroll-mb-28 ${salon.id === selectedSalon?.id ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
    >
      <SalonCard
        layout="row"
        salon={withStartingPrice(salon) as any}
        index={i}
        onSelect={() => navigate(`/salon/${salon.id}`)}
        isFavorited={favoriteIdSet.has(salon.id)}
        onToggleFavorite={handleToggleFavorite}
        // Beside the map, each salon with a location can be found on it.
        onShowOnMap={splitMap && salon.locationQuality !== "missing" ? () => setSelectedSalonId(salon.id) : undefined}
        shownOnMap={salon.id === selectedSalon?.id}
      />
    </div>
  );

  if (authLoading) {
    return null;
  }

  // Small uppercase mono label — the landing page's section-label style.
  const eyebrow = "font-mono text-[10px] font-semibold uppercase tracking-[0.18em]";

  const searchBox = (
    <div className="relative w-full max-w-2xl lg:max-w-none">
      <div className="flex min-h-11 items-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-1 transition-colors focus-within:border-primary/70 focus-within:bg-white/[0.07] sm:py-2">
        <Search className="mr-3 h-4 w-4 shrink-0 text-white/50" aria-hidden="true" />
        <Input
          ref={searchInputRef}
          aria-label="Search salons"
          placeholder={isNarrow ? "Search salons or areas…" : "Search salons, landmarks, addresses…"}
          value={search}
          onFocus={() => setShowSuggestions(true)}
          // Escape closes the suggestions (they cover the filters on phones).
          onKeyDown={(e) => {
            if (e.key === "Escape") setShowSuggestions(false);
          }}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          onChange={(e) => {
            setSearch(e.target.value);
            setShowSuggestions(true);
          }}
          className="h-9 w-full border-none bg-transparent px-0 text-[15px] text-white shadow-none placeholder:text-white/40 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        {search ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setSearch("")}
            className="-mr-2 ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      {showSuggestions && uniqueSuggestions.length > 0 ? (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-elevation-3">
          <p className={`border-b border-border px-4 py-3 text-muted-foreground ${eyebrow}`}>Search suggestions</p>
          <div className="max-h-80 overflow-auto py-1">
            {uniqueSuggestions.map((item) => (
              <button
                key={`${item.category}-${item.label}`}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setSearch(item.value);
                  // A city suggestion picks that city; a salon or place clears the
                  // city filter so the searched salon is visible (as before).
                  chooseCity(item.category === "city" ? item.value : null);
                  setShowSuggestions(false);
                }}
                className="flex w-full items-baseline gap-3 px-4 py-2.5 text-left transition hover:bg-muted/70"
              >
                <span className={`w-14 shrink-0 text-primary ${eyebrow}`}>{item.category}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">{item.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{item.subtitle}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );

  const locationNote =
    detection === "denied" && !cityChoice
      ? "Location access is blocked. Allow it in your browser settings to detect your city, or choose one."
      : detection === "failed" && !cityChoice
      ? `${geoError ?? "Location unavailable"}. Try again, or choose your city.`
      : detection === "unresolved" && !cityChoice
      ? "We found your location but couldn't identify the city. Try again, or choose it instead."
      : detection === "unsupported" && !cityChoice
      ? "This browser can't share your location. Choose your city instead."
      : detection === "insecure" && !cityChoice
      ? "Location only works on a secure (https) connection. Choose your city instead."
      : cityChoice?.source === "detected" && cityCounts !== null && !matchedDetectedCity
      ? `No salons on Snippr in ${cityChoice.place.city} yet.`
      : null;
  const canRetryDetect = detection === "idle" || detection === "failed" || detection === "unresolved";

  const cityStatus = detecting ? "Detecting your city…" : cityLabel ?? "Choose your city";
  const showDetect = !cityChoice && !detecting && detection !== "denied" && canRetryDetect;
  const detectLabel = detection === "idle" ? "Detect my city" : "Try again";
  const locationNotes = (
    <>
      {locationNote ? (
        <p role="status" className="mt-2 text-xs leading-relaxed text-white/60">
          {locationNote}
        </p>
      ) : null}
      {!cityChoice && (detection === "idle" || detecting) ? (
        <p className="mt-2 text-xs leading-relaxed text-white/55">
          Used only for your city and distances. It isn’t saved.
        </p>
      ) : null}
      {coarseLocation ? (
        <p className="mt-2 text-xs leading-relaxed text-white/60">
          Your device gave an approximate location (about {Math.round((geoAccuracy ?? 0) / 1000)} km), so distances are approximate.
        </p>
      ) : null}
      {cityChoice?.source === "detected" ? (
        <p className="mt-1.5 text-[11px] text-white/40">
          City lookup ©{" "}
          <a href={REVERSE_GEOCODE_ATTRIBUTION.href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-white/70">
            {REVERSE_GEOCODE_ATTRIBUTION.label}
          </a>
        </p>
      ) : null}
    </>
  );

  // Phones: one compact row — the city itself is the button that opens the picker.
  // Larger screens keep the labelled panel with separate buttons.
  const locationPanel = isNarrow ? (
    <div className="min-w-0">
      <section aria-label="Your city" className="flex items-center gap-2">
        <button
          ref={cityTriggerRef}
          type="button"
          onClick={() => setPickerOpen(true)}
          aria-haspopup="dialog"
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-left transition-colors hover:border-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <MapPin className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="sr-only">Your city: </span>
            <span data-testid="location-status" className="block truncate text-sm font-semibold text-white">
              {cityStatus}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-white/50" aria-hidden="true" />
        </button>
        {showDetect ? (
          <button
            type="button"
            onClick={handleDetectCity}
            aria-label={detectLabel}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-accent transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <LocateFixed className="h-4 w-4" aria-hidden="true" />
            {/* Icon-only below 360px so the city name has room; the name stays "Detect my city". */}
            <span className="hidden min-[360px]:inline">{detection === "idle" ? "Detect" : "Try again"}</span>
          </button>
        ) : null}
      </section>
      <p aria-live="polite" className="sr-only">
        {detecting ? cityStatus : ""}
      </p>
      {locationNotes}
    </div>
  ) : (
    <div className="min-w-0">
      <section
        aria-label="Your city"
        className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2"
      >
        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-accent">
          <MapPin className="h-4 w-4" />
        </span>
        <div className="min-w-[9rem] flex-1" aria-live="polite">
          <p className="whitespace-nowrap font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">Your city</p>
          <p data-testid="location-status" className="truncate font-display text-[15px] font-semibold tracking-[-0.01em] text-white">
            {cityStatus}
          </p>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {showDetect ? (
            <button
              type="button"
              onClick={handleDetectCity}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-accent transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <LocateFixed className="h-4 w-4" aria-hidden="true" />
              {detectLabel}
            </button>
          ) : null}
          <button
            ref={cityTriggerRef}
            type="button"
            onClick={() => setPickerOpen(true)}
            aria-haspopup="dialog"
            className="min-h-10 rounded-lg border border-white/[0.12] px-3 text-sm text-white/80 transition-colors hover:border-white/25 hover:text-white"
          >
            {cityChoice ? "Change city" : "Choose city"}
          </button>
        </div>
      </section>
      {locationNotes}
    </div>
  );

  const chipClass = (on: boolean) =>
    `inline-flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-colors lg:h-9 ${
      on ? "border-foreground bg-foreground text-background" : "border-border bg-card text-foreground hover:border-foreground/40"
    }`;

  const filterBar = (
    <div className="mb-3 space-y-3 sm:mb-4">
      <div
        role="group"
        aria-label="Quick filters"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [mask-image:linear-gradient(to_right,black_88%,transparent)] [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:[mask-image:none] [&::-webkit-scrollbar]:hidden"
      >
        <button
          ref={allFiltersRef}
          type="button"
          aria-haspopup="dialog"
          onClick={() => setSheetOpen(true)}
          className={chipClass(false)}
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          All filters
          {activeFilterCount > 0 ? (
            <span className="ml-0.5 rounded-full bg-primary px-1.5 font-mono text-[11px] leading-5 text-primary-foreground">
              {activeFilterCount}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          aria-pressed={filters.openNow}
          onClick={() => setFilters((f) => ({ ...f, openNow: !f.openNow }))}
          className={chipClass(filters.openNow)}
        >
          Open now
        </button>
        <button
          type="button"
          aria-pressed={filters.shortWait}
          onClick={() => setFilters((f) => ({ ...f, shortWait: !f.shortWait }))}
          className={chipClass(filters.shortWait)}
        >
          Short wait
        </button>
        {quickCategories.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={filters.categories.includes(c.id)}
            onClick={() => setFilters((f) => ({ ...f, categories: toggleIn(f.categories, c.id) }))}
            className={chipClass(filters.categories.includes(c.id))}
          >
            {c.label}
          </button>
        ))}
      </div>

      {appliedChips.length > 0 ? (
        <div role="group" aria-label="Applied filters" className="flex flex-wrap items-center gap-2">
          {appliedChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => setFilters(chip.remove)}
              aria-label={`Remove filter: ${chip.label}`}
              className="inline-flex h-11 items-center gap-1 rounded-full bg-primary/10 px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/15 lg:h-9"
            >
              {chip.label}
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ))}
          <button
            type="button"
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="h-11 px-2 text-xs font-semibold text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline lg:h-9"
          >
            Clear all
          </button>
        </div>
      ) : null}
    </div>
  );

  // Shared by List view, the desktop side list and the mobile map view.
  const emptyState = (
    <div className="col-span-full rounded-2xl border border-dashed border-border px-6 py-12 text-center">
      <p className="font-display text-lg font-semibold tracking-[-0.01em] text-foreground">
        {activeFilterCount > 0
          ? "No salons match these filters"
          : filterCity && !debouncedSearch.trim()
          ? `No salons in ${filterCity} yet`
          : "No salons found"}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {activeFilterCount > 0
          ? `Active filters: ${appliedChips.map((c) => c.label).join(" · ")}`
          : "Try a different search term or city."}
      </p>
      {activeFilterCount > 0 || filterCity || search.trim() ? (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {search.trim() ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className={`min-h-11 rounded-lg px-4 text-sm font-semibold transition ${
                activeFilterCount > 0 || filterCity
                  ? "border border-border text-foreground hover:border-primary/40"
                  : "bg-primary text-primary-foreground hover:brightness-110"
              }`}
            >
              Clear search
            </button>
          ) : null}
          {activeFilterCount > 0 ? (
            <button
              type="button"
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:brightness-110"
            >
              Clear filters
            </button>
          ) : null}
          {filterCity ? (
            <>
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="min-h-11 rounded-lg border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:border-primary/40"
              >
                Change city
              </button>
              <button
                type="button"
                onClick={() => chooseCity(null)}
                className={`min-h-11 rounded-lg px-4 text-sm font-semibold transition ${
                  activeFilterCount > 0
                    ? "border border-border text-foreground hover:border-primary/40"
                    : "bg-primary text-primary-foreground hover:brightness-110"
                }`}
              >
                Show all cities
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  const listBody = loading
    ? [1, 2, 3, 4].map((i) => (
        <div key={i} data-testid="salon-card-skeleton" aria-hidden="true" className="flex h-40 overflow-hidden rounded-2xl border border-border bg-card">
          <div className="w-24 shrink-0 animate-pulse bg-muted sm:w-36 md:w-28 xl:w-36" />
          <div className="flex-1 space-y-3 p-4">
            <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))
    : loadError
    ? (
      <div className="col-span-full">
        <ErrorState message={loadError} />
      </div>
    )
    : sortedFiltered.length === 0
    ? emptyState
    : sortedFiltered.map(renderSalonCard);

  const mapPanel = loading ? (
    <MapSkeleton />
  ) : loadError ? (
    <MapNotice>The map needs the salon list, which couldn't load right now.</MapNotice>
  ) : (
    <SalonMapPanel
      salons={sortedFiltered.map((salon) => ({ ...salon, ...withDistanceInfo(salon) }))}
      selectedId={selectedSalon?.id ?? null}
      onSelect={handleMarkerSelect}
      userLocation={userCoords}
      scrollWheelZoom={isDesktop}
      fallbackView={salonMapFallbackView(filterCity, userCoords, sortedFiltered)}
      onLocate={handleLocateMe}
      locating={geoStatus === "pending"}
      centreOnUser={centreOnUser}
      onCentred={() => setCentreOnUser(false)}
      locationMessage={locationMessage}
      onDismissLocationMessage={() => setLocationMessageDismissed(true)}
      preview={
        selectedSalon ? (
          <SalonMapPreview
            salon={withStartingPrice(selectedSalon)}
            onOpen={() => navigate(`/salon/${selectedSalon.id}`)}
            onClose={() => setSelectedSalonId(null)}
          />
        ) : null
      }
    />
  );

  return (
    <div className="min-h-screen bg-background">
      <FilterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        value={filters}
        onApply={setFilters}
        options={filterOptions}
        countFor={(draft) => applyDiscoveryFilters(filtered, draft, filterCtx).length}
        returnFocusTo={allFiltersRef}
      />
      <CityPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        cityCounts={cityCounts}
        unlistedCount={cityOptionsData?.unlisted ?? null}
        otherCities={INDIA_CITIES}
        selectedCity={filterCity}
        onSelectCity={chooseCity}
        returnFocusTo={cityTriggerRef}
        onDetect={detection === "denied" || detection === "unsupported" || detection === "insecure" ? null : handleDetectCity}
        detectNote={
          detection === "denied"
            ? "Location access is blocked in this browser. Allow it in your browser settings to detect your city."
            : detection === "unsupported"
            ? "This browser can't share your location."
            : detection === "insecure"
            ? "Location only works on a secure (https) connection."
            : null
        }
      />
      <Header
        onSignOut={signOut}
        userName={user ? (user.email ?? user.phone ?? "User") : undefined}
        userEmail={user?.email || undefined}
        profileName={profile?.name || undefined}
        onAdminToggle={profile ? () => navigate("/owner-dashboard") : undefined}
        isAdmin={false}
      />

      {/* Masthead in the landing page's language: near-black, faint grid, one violet glow. */}
      <section aria-labelledby="salons-heading" className="relative bg-[#050507] text-white">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
              backgroundSize: "56px 56px",
            }}
          />
          <div
            className="absolute -top-40 right-[8%] h-[420px] w-[420px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(124,58,237,0.22), transparent 65%)", filter: "blur(60px)" }}
          />
        </div>
        <div className={`relative pb-4 pt-4 sm:pb-8 sm:pt-10 ${PAGE_CONTAINER}`}>
          {/* The eyebrow is decorative; phones skip it to get to the salons sooner. */}
          <p className={`mb-3 hidden text-accent sm:block ${eyebrow}`}>Explore</p>
          <h1
            id="salons-heading"
            className="font-display text-[1.75rem] font-extrabold leading-[1.02] tracking-[-0.028em] sm:text-5xl"
          >
            Explore Salons
          </h1>
          <p className="mt-3 hidden max-w-xl text-[15px] text-white/60 sm:block">
            Compare live queues and wait times, and book your appointment.
          </p>
          <div className="mt-3 grid gap-2 sm:mt-6 sm:gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-start">
            {searchBox}
            {locationPanel}
          </div>
        </div>
      </section>

      <main className={`pb-16 pt-3 sm:pt-5 lg:pt-6 ${PAGE_CONTAINER}`}>
        <div className="min-w-0">
          <section aria-label="Results" className="min-w-0">
            {filterBar}
            {/* Mobile: count + view switch on one row, sort underneath. sm+: one row. */}
            <div className="mb-3 flex flex-wrap items-end gap-x-5 gap-y-2 border-b border-border pb-3 sm:mb-5 sm:gap-y-3">
              <p aria-live="polite" className="mr-auto font-display text-xl font-semibold tracking-[-0.02em] text-foreground">
                {loading || loadError
                  ? "\u00a0"
                  : `${sortedFiltered.length} ${sortedFiltered.length === 1 ? "salon" : "salons"}`}
              </p>
              <div className="contents">
                <div role="group" aria-label="Sort salons" className="order-last flex w-full items-center gap-3 text-sm sm:order-none sm:w-auto sm:gap-4">
                  <span className={`hidden text-muted-foreground min-[360px]:inline ${eyebrow}`}>Sort</span>
                  {SORT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={effectiveSort === option.value}
                      aria-describedby={option.value === "distance" && sortNote ? "sort-note" : undefined}
                      // Only unavailable when no salon here has a location to measure to.
                      disabled={option.value === "distance" && !!userCoords && !anyDistance}
                      onClick={() => {
                        setSortBy(option.value);
                        setSortChosen(true);
                        // An explicit request: the browser asks for location only now.
                        if (option.value === "distance" && !userCoords && geoStatus !== "pending") {
                          setNearestRequested(true);
                          requestLocation();
                        }
                      }}
                      className={`-mb-[13px] whitespace-nowrap border-b-2 pb-2.5 pt-2 transition-colors disabled:cursor-not-allowed disabled:text-muted-foreground/50 ${
                        effectiveSort === option.value
                          ? "border-primary font-semibold text-foreground"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div role="group" aria-label="Salon view" className="flex rounded-lg border border-border bg-card p-0.5">
                  {(["list", "map"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={view === mode}
                      onClick={() => setView(mode)}
                      className={`flex min-h-10 items-center gap-1.5 rounded-md px-3.5 text-sm font-medium transition-colors ${
                        view === mode ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {mode === "list" ? <ListIcon className="h-4 w-4" aria-hidden="true" /> : <MapIcon className="h-4 w-4" aria-hidden="true" />}
                      {mode === "list" ? "List" : "Map"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {sortedFiltered.some((salon) => salon.locationDemo) ? (
              <p
                role="note"
                data-testid="demo-locations-note"
                className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900"
              >
                <span className="font-semibold">Demo locations:</span> map positions and distances for these salons use
                test coordinates for trying out the map — they are not real or verified salon locations.
              </p>
            ) : null}
            {sortNote ? (
              <p id="sort-note" role="status" className="-mt-1 mb-3 text-xs leading-relaxed text-muted-foreground sm:-mt-2 sm:mb-4">
                {sortNote}
              </p>
            ) : null}

            {view === "list" ? (
              <section aria-label="Salon list" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {listBody}
              </section>
            ) : splitMap ? (
              // Desktop map view: results on the left (~40%), the map on the right (~60%),
              // sticky below the header so it stays in view while the list scrolls with the page.
              <div data-testid="map-split" className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start gap-5 xl:gap-6">
                <section aria-label="Salon list" className="grid min-w-0 grid-cols-1 gap-3">
                  {listBody}
                </section>
                <div className="sticky top-20 h-[clamp(480px,calc(100dvh-7rem),720px)] min-w-0">{mapPanel}</div>
              </div>
            ) : (
              <div className="space-y-4">
                {!loading && !loadError && sortedFiltered.length === 0 ? emptyState : null}
                <div className="h-[min(62dvh,560px)] min-h-[340px]">{mapPanel}</div>
              </div>
            )}
          </section>
        </div>
      </main>

      <QueueTracker />
    </div>
  );
};

export default Salons;


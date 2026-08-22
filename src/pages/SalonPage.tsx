import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Clock, Heart, MapPin, Phone, Scissors } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { publicSupabase } from "@/integrations/supabase/publicClient";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { SalonCardSkeleton } from "@/components/design/Skeleton";
import { ErrorState } from "@/components/design/ErrorState";
import { formatINR } from "@/lib/currency";
import { startBookingFlow } from "@/contexts/BookingDraftContext";

const getSalonImageSrc = (imageUrl: string | null) => {
  if (!imageUrl) return "/default-salon.jpg";
  if (imageUrl.startsWith("http") || imageUrl.startsWith("/")) return imageUrl;
  const { data } = supabase.storage.from("salon-images").getPublicUrl(imageUrl);
  return data.publicUrl || "/default-salon.jpg";
};

export default function SalonPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const [salon, setSalon] = useState<any>(null);
  const [services, setServices] = useState<{ id: string; name: string; price: number | null; duration: number | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);

  useEffect(() => {
    const fetchSalon = async () => {
      if (!id) {
        setErrorMessage("Salon not found");
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorMessage(null);

      try {
        const fetchPromise = publicSupabase
          .from("salons")
          .select("id, name, owner_id, image_url, address, city, phone, open_time, close_time, location, latitude, longitude, pincode")
          .eq("id", id)
          .maybeSingle();

        const timeoutPromise = new Promise<any>((_, reject) => setTimeout(() => reject(new Error("Network timeout")), 8000));

        const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);

        if (error) {
          setErrorMessage("Could not load salon details. Please check your connection.");
          setSalon(null);
        } else if (!data) {
          setErrorMessage("Salon not found.");
          setSalon(null);
        } else {
          const safeSalon = {
            ...data,
            name: data.name ?? "Salon",
            image_url: data.image_url ?? "/default-salon.jpg",
            address: data.address ?? "Address not available",
            city: data.city ?? "City not specified",
            phone: data.phone ?? "",
            open_time: data.open_time ?? "09:00",
            close_time: data.close_time ?? "20:00",
          };
          setSalon(safeSalon);

          const { data: serviceRows } = await publicSupabase
            .from("services")
            .select("id, name, price, duration")
            .eq("salon_id", id)
            .order("name");
          setServices(serviceRows || []);
        }
      } catch {
        setErrorMessage("Connection timed out. Please try again.");
        setSalon(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSalon();
  }, [id]);

  useEffect(() => {
    if (!user || !id) return;
    supabase
      .from("customer_favorite_salons")
      .select("id")
      .eq("user_id", user.id)
      .eq("salon_id", id)
      .maybeSingle()
      .then(({ data }) => setIsFavorited(!!data));
  }, [user, id]);

  const toggleFavorite = async () => {
    if (!user || !id || favoriteBusy) return;
    setFavoriteBusy(true);
    const next = !isFavorited;
    setIsFavorited(next);
    if (next) {
      await supabase.from("customer_favorite_salons").insert({ user_id: user.id, salon_id: id });
    } else {
      await supabase.from("customer_favorite_salons").delete().eq("user_id", user.id).eq("salon_id", id);
    }
    setFavoriteBusy(false);
  };

  const headerProps = {
    onSignOut: signOut,
    userName: user?.email || "User",
    userEmail: user?.email || undefined,
    profileName: profile?.name || undefined,
    isAdmin: false,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header {...headerProps} />
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 p-4 sm:p-6 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <SalonCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (errorMessage || !salon) {
    return (
      <div className="min-h-screen bg-background">
        <Header {...headerProps} />
        <div className="flex items-center justify-center px-6 py-20">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card">
            <ErrorState message={errorMessage || "No data available"} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header {...headerProps} />

      <div className="mx-auto w-full max-w-4xl px-4 pb-16 pt-6 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl">
          <img src={getSalonImageSrc(salon.image_url)} alt={salon.name} className="h-56 w-full object-cover sm:h-72" />
          {user && (
            <button
              onClick={toggleFavorite}
              aria-label={isFavorited ? "Remove from favorites" : "Save to favorites"}
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm transition hover:bg-black/60"
            >
              <Heart className={`h-5 w-5 ${isFavorited ? "fill-destructive text-destructive" : "text-white"}`} />
            </button>
          )}
        </div>

        <div className="mt-6 space-y-2">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">{salon.name}</h1>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" /> {salon.address}, {salon.city}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" /> {salon.open_time} – {salon.close_time}
            </span>
            {salon.phone && (
              <span className="flex items-center gap-1.5">
                <Phone className="h-4 w-4" /> {salon.phone}
              </span>
            )}
          </div>
        </div>

        <div className="mt-8">
          <h2 className="mb-3 font-display text-lg font-bold text-foreground">Services</h2>
          {services.length === 0 ? (
            <p className="text-sm text-muted-foreground">No services listed yet.</p>
          ) : (
            <div className="space-y-2">
              {services.map((service) => (
                <div key={service.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Scissors className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{service.name}</p>
                      <p className="text-xs text-muted-foreground">{service.duration ?? 30} min</p>
                    </div>
                  </div>
                  <p className="font-mono text-sm font-bold text-foreground">{formatINR(service.price ?? 0)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-4 backdrop-blur-sm sm:static sm:mt-8 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
          <Button
            size="lg"
            className="h-12 w-full rounded-xl text-base font-bold sm:mx-auto sm:max-w-xs"
            onClick={() => startBookingFlow(salon.id, navigate)}
          >
            Book Now / Join Queue
          </Button>
        </div>
      </div>
    </div>
  );
}

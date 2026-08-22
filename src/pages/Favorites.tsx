import { Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import SalonCard from "@/components/SalonCard";
import { SalonCardSkeleton } from "@/components/design/Skeleton";
import { ErrorState } from "@/components/design/ErrorState";
import type { Tables } from "@/integrations/supabase/types";

type FavoriteSalon = Tables<"salons"> & { queueCount: number; waitTime: number };

const Favorites = () => {
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    data: favoriteSalons = [],
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: ["favorite-salons", user?.id],
    queryFn: async (): Promise<FavoriteSalon[]> => {
      const { data: favoriteRows, error: favoriteError } = await supabase
        .from("customer_favorite_salons")
        .select("salon_id")
        .eq("user_id", user!.id);

      if (favoriteError) throw favoriteError;

      const salonIds = (favoriteRows ?? []).map((row) => row.salon_id);
      if (salonIds.length === 0) return [];

      const { data, error } = await supabase
        .from("salon_with_stats" as any)
        .select("*")
        .in("id", salonIds);

      if (error) throw error;

      return (data as any[]).map((salon) => ({
        ...salon,
        queueCount: salon.queue_count,
        waitTime: salon.wait_time,
      }));
    },
    enabled: !!user,
  });

  const loadError = queryError ? "Could not load your favorites right now." : null;

  const handleToggleFavorite = async (salon: Tables<"salons">) => {
    if (!user) return;

    // Optimistic removal — this page only ever shows favorited salons.
    queryClient.setQueryData<FavoriteSalon[]>(["favorite-salons", user.id], (prev = []) =>
      prev.filter((s) => s.id !== salon.id)
    );
    queryClient.setQueryData<string[]>(["favorite-salon-ids", user.id], (prev = []) =>
      prev.filter((id) => id !== salon.id)
    );

    try {
      const { error } = await supabase
        .from("customer_favorite_salons")
        .delete()
        .eq("user_id", user.id)
        .eq("salon_id", salon.id);
      if (error) throw error;
    } catch (err) {
      console.error("FAVORITE_REMOVE_ERROR", err);
      queryClient.invalidateQueries({ queryKey: ["favorite-salons", user.id] });
      queryClient.invalidateQueries({ queryKey: ["favorite-salon-ids", user.id] });
    }
  };

  if (authLoading || !user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header
        onSignOut={signOut}
        userName={user.email ?? user.phone ?? "User"}
        userEmail={user.email || undefined}
        profileName={profile?.name || undefined}
        isAdmin={false}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-16">
        <div className="space-y-8">
          <header>
            <span className="font-mono font-bold text-xs uppercase tracking-widest text-primary mb-2 block">
              Saved For Later
            </span>
            <h1 className="font-display font-extrabold text-3xl sm:text-4xl tracking-tight text-foreground">
              Your Favorites
            </h1>
          </header>

          <section className="grid gap-6 sm:gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {loading
              ? [1, 2, 3, 4].map((i) => <SalonCardSkeleton key={i} />)
              : loadError
              ? (
                <div className="col-span-full">
                  <ErrorState message={loadError} />
                </div>
              )
              : favoriteSalons.length === 0
              ? (
                <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                    <Heart className="h-6 w-6 text-primary" />
                  </div>
                  <p className="font-display text-lg font-semibold text-foreground">No favorites yet</p>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    Tap the heart on any salon to save it here for quick access later.
                  </p>
                  <button
                    onClick={() => navigate("/salons")}
                    className="mt-6 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:brightness-110 active:scale-95"
                  >
                    Explore salons
                  </button>
                </div>
              )
              : favoriteSalons.map((salon, i) => (
                  <SalonCard
                    key={salon.id}
                    salon={salon as any}
                    index={i}
                    onSelect={() => navigate(`/salon/${salon.id}`)}
                    isFavorited
                    onToggleFavorite={handleToggleFavorite}
                  />
                ))}
          </section>
        </div>
      </main>
    </div>
  );
};

export default Favorites;

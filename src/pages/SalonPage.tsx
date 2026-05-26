import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { publicSupabase } from "@/integrations/supabase/publicClient";
import SalonDetail from "@/components/SalonDetail";
import Header from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";

export default function SalonPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const [salon, setSalon] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
        // Only select columns that actually exist in the salons table
        const fetchPromise = publicSupabase
          .from("salons")
          .select("id, name, owner_id, image_url, address, city, phone, open_time, close_time, location, latitude, longitude, pincode")
          .eq("id", id)
          .maybeSingle();
        
        const timeoutPromise = new Promise<any>((_, reject) => 
          setTimeout(() => reject(new Error("Network timeout")), 8000)
        );

        const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);

        if (error) {
          console.error("SALON_DETAIL_FETCH_ERROR", {
            salon_id: id,
            error_code: error.code,
            error_message: error.message,
            status: error.status
          });
          setErrorMessage("Could not load salon details. Please check your connection.");
          setSalon(null);
        } else if (!data) {
          console.warn("SALON_NOT_FOUND", { salon_id: id });
          setErrorMessage("Salon not found.");
          setSalon(null);
        } else {
          // Apply safe defaults for all fields
          const safeSalon = {
            ...data,
            name: data.name ?? "Salon",
            image_url: data.image_url ?? "/default-salon.jpg",
            address: data.address ?? "Address not available",
            city: data.city ?? "City not specified",
            phone: data.phone ?? "",
            open_time: data.open_time ?? "09:00",
            close_time: data.close_time ?? "20:00"
          };
          setSalon(safeSalon);
          console.log("SALON_DETAIL_LOADED_SUCCESS", { salon_id: id, name: safeSalon.name });
        }
      } catch (err: any) {
        console.error("SALON_DETAIL_FETCH_EXCEPTION", {
          salon_id: id,
          error_name: err.name,
          error_message: err.message
        });
        setErrorMessage("Connection timed out. Please try again.");
        setSalon(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSalon();
  }, [id]);

  if (loading) return (
    <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-40 bg-gray-200 animate-pulse rounded-xl"></div>
      ))}
    </div>
  );

  if (errorMessage) return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <p className="text-center text-gray-400">{errorMessage}</p>
    </div>
  );

  if (!salon) return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-center text-gray-400">No data available</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-16">
      <Header
        onSignOut={signOut}
        userName={user?.email || "User"}
        userEmail={user?.email || undefined}
        profileName={profile?.name || undefined}
        isAdmin={false}
      />
      <main className="container mx-auto mt-8 max-w-3xl px-4">
         <SalonDetail 
            salon={salon} 
            onBack={() => navigate("/salons")} 
            onJoined={() => navigate("/bookings")} 
         />
      </main>
    </div>
  );
}


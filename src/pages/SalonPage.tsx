import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SalonDetail from "@/components/SalonDetail";
import Header from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";

export default function SalonPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
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

      const { data, error } = await supabase.from("salons").select("*").eq("id", id).maybeSingle();

      if (error) {
        console.error("Failed to load salon:", error);
        setErrorMessage("Could not load salon details.");
        setSalon(null);
      } else {
        setSalon(data ?? null);
      }

      setLoading(false);
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
    <div className="flex min-h-screen items-center justify-center bg-[#F9FAFB] dark:bg-[#09090B] px-6">
      <p className="text-center text-gray-400">{errorMessage}</p>
    </div>
  );

  if (!salon) return (
    <div className="flex min-h-screen items-center justify-center bg-[#F9FAFB] dark:bg-[#09090B]">
      <p className="text-center text-gray-400">No data available</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F9FAFB] pb-16 dark:bg-[#09090B]">
      <Header
        onSignOut={signOut}
        userName={user?.email || "User"}
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

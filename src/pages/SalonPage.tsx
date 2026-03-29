import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SalonDetail from "@/components/SalonDetail";
import { Loader2 } from "lucide-react";
import Header from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";

export default function SalonPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [salon, setSalon] = useState<any>(null);

  useEffect(() => {
    if (!id) return;
    supabase.from("salons").select("*").eq("id", id).single()
      .then(({ data }) => setSalon(data));
  }, [id]);

  if (!salon) return (
    <div className="flex min-h-screen items-center justify-center bg-[#F9FAFB] dark:bg-[#09090B]">
      <div className="h-6 w-6 animate-spin rounded-full border-[2.5px] border-zinc-200 border-t-zinc-900 dark:border-zinc-800 dark:border-t-zinc-50" />
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

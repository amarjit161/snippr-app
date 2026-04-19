import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const ProtectedRoute = () => {
  const { session, loading } = useAuth();
  const location = useLocation();
  const [profileComplete, setProfileComplete] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);

  useEffect(() => {
    const checkProfileCompletion = async () => {
      if (!session?.user) {
        console.log("PROTECTED_ROUTE: No session user");
        setCheckingProfile(false);
        return;
      }

      try {
        const { data: profile } = await supabase
          .from('customer_profiles')
          .select('phone, gender')
          .eq('id', session.user.id)
          .maybeSingle();

        console.log("PROTECTED_ROUTE: Profile check", { 
          userId: session.user.id, 
          phone: profile?.phone ? "✓ Set" : "✗ Not set",
          gender: profile?.gender ? "✓ Set" : "✗ Not set",
          profileComplete: !!(profile?.phone && profile?.gender)
        });

        // Profile is complete if both phone and gender are set
        if (profile?.phone && profile?.gender) {
          console.log("PROTECTED_ROUTE: Profile complete ✓");
          setProfileComplete(true);
        } else {
          console.log("PROTECTED_ROUTE: Profile incomplete ✗ - Redirect to /profile-completion needed");
          setProfileComplete(false);
        }
      } catch (err) {
        console.error('PROTECTED_ROUTE: Error checking profile completion:', err);
        setProfileComplete(false);
      } finally {
        setCheckingProfile(false);
      }
    };

    checkProfileCompletion();
  }, [session?.user?.id]);

  if (loading || checkingProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F9FAFB] dark:bg-[#09090B]">
        <div className="h-6 w-6 animate-spin rounded-full border-[2.5px] border-zinc-200 border-t-zinc-900 dark:border-zinc-800 dark:border-t-zinc-50" />
      </div>
    );
  }

  if (!session) {
    const redirectPath = `${location.pathname}${location.search}${location.hash}`;
    localStorage.setItem("redirectAfterLogin", redirectPath);
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Redirect to profile completion if not complete
  if (!profileComplete && location.pathname !== "/profile-completion") {
    return <Navigate to="/profile-completion" replace />;
  }

  return <Outlet />;
};

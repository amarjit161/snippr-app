import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import OTPLogin from "@/components/OTPLogin";

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const role = searchParams.get("role");
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    if (role) {
      localStorage.setItem("snippr_role", role);
    }
  }, [role]);

  useEffect(() => {
    let mounted = true;

    // 1. Initial manual session check
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) console.error("Session fetch error:", error);
        
        if (session && mounted) {
           handleSuccessRedirect();
        }
      } catch (err) {
        console.error("Unexpected error in checkSession:", err);
      } finally {
        if (mounted) setIsCheckingAuth(false);
      }
    };

    checkSession();

    // 2. Real-time auth listener (vital for Magic Links)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // SIGNED_IN covers Magic Links parsing the token from URL hash successfully
      if (event === "SIGNED_IN" && session) {
        handleSuccessRedirect();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSuccessRedirect = () => {
    // Determine route based on previously stored intent
    const intended = localStorage.getItem("snippr_role");
    
    if (intended === "owner") {
      navigate("/admin", { replace: true });
    } else {
      // Default / Customer redirect
      navigate("/dashboard", { replace: true });
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent shadow-sm" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <OTPLogin />
      </div>
    </div>
  );
};

export default Auth;

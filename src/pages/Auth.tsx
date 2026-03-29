import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import OTPLogin from "@/components/OTPLogin";

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const role = searchParams.get("role");
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const location = useLocation();

  // Parse errors from URL hash (Supabase usually appends OAuth/Magic Link errors here)
  const hashParams = new URLSearchParams(location.hash.substring(1));
  const authError = hashParams.get("error_description") || hashParams.get("error") || searchParams.get("error_description");

  useEffect(() => {
    if (role) {
      localStorage.setItem("snippr_role", role);
    }
  }, [role]);

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      try {
        if (authError) {
           // Skip automatic check if there's an explicit error passed back from Supabase
           setIsCheckingAuth(false);
           return;
        }

        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        if (session && mounted) {
           handleSuccessRedirect();
        }
      } catch (err) {
        console.error("Auth session check error:", err);
      } finally {
        if (mounted) setIsCheckingAuth(false);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        handleSuccessRedirect();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [authError]);

  const handleSuccessRedirect = () => {
    const intended = localStorage.getItem("snippr_role");
    
    if (intended === "owner") {
      navigate("/admin", { replace: true });
    } else {
      navigate("/dashboard", { replace: true });
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F9FAFB] dark:bg-[#09090B]">
        <div className="h-6 w-6 animate-spin rounded-full border-[2.5px] border-zinc-200 border-t-zinc-900 dark:border-zinc-800 dark:border-t-zinc-50" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F9FAFB] p-4 dark:bg-[#09090B]">
      <div className="w-full max-w-[400px]">
        <OTPLogin 
           initialError={authError ? "This login link has expired or is invalid. Please request a new one." : null} 
        />
      </div>
    </div>
  );
};

export default Auth;

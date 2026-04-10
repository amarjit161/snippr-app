import { useEffect } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import OTPLogin from "@/components/OTPLogin";

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const role = searchParams.get("role");

  // Parse errors from URL hash (Supabase usually appends OAuth/Magic Link errors here)
  const hashParams = new URLSearchParams(location.hash.substring(1));
  let authError = hashParams.get("error_description") || hashParams.get("error") || searchParams.get("error_description");
  
  if (searchParams.get("error") === "otp_expired") {
    authError = "Session expired, please login again";
  }

  useEffect(() => {
    if (role) {
      localStorage.setItem("snippr_role", role);
    }
  }, [role]);

  useEffect(() => {
    if (user && !authError) {
      handleSuccessRedirect();
    }
  }, [user, authError]);

  const handleSuccessRedirect = () => {
    const redirectPath = localStorage.getItem("redirectAfterLogin");
    console.log("Redirect path:", redirectPath);

    if (redirectPath) {
      localStorage.removeItem("redirectAfterLogin");
      navigate(redirectPath, { replace: true });
      return;
    }

    const intended = localStorage.getItem("snippr_role");
    
    if (intended === "owner") {
      navigate("/register-salon", { replace: true });
    } else {
      navigate("/salons", { replace: true });
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-[2.5px] border-zinc-200 border-t-zinc-900 dark:border-zinc-800 dark:border-t-zinc-50" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_10%,_rgba(109,40,217,0.2),_transparent_35%),radial-gradient(circle_at_84%_16%,_rgba(249,115,22,0.2),_transparent_38%)]" />
      <div className="relative w-full max-w-[440px]">
        <OTPLogin 
           initialError={authError === "Session expired, please login again" ? authError : (authError ? "This login link has expired or is invalid. Please request a new one." : null)} 
        />
      </div>
    </div>
  );
};

export default Auth;

import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import OTPLogin from "@/components/OTPLogin";

const Auth = () => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const role = searchParams.get("role");

  useEffect(() => {
    if (role) {
      localStorage.setItem("snippr_role", role);
    }

    if (!loading && user && profile !== undefined) {
      if (profile?.role === "salon_owner") {
        navigate("/admin", { replace: true });
      } else {
        const intended = localStorage.getItem("snippr_role");
        if (intended === "owner") {
          // Send future owners to register form
          navigate("/register", { replace: true });
        } else {
          // Customers go to salons
          navigate("/salons", { replace: true });
        }
      }
    }
  }, [user, profile, loading, navigate, role]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <OTPLogin />
      </div>
    </div>
  );
};

export default Auth;

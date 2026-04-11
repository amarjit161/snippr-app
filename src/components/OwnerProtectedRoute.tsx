import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface OwnerProtectedRouteProps {
  children: ReactNode;
}

export const OwnerProtectedRoute = ({ children }: OwnerProtectedRouteProps) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    console.log("OWNER_PROTECTED_ROUTE: Loading...");
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    console.log("OWNER_PROTECTED_ROUTE: No user found, redirecting to login");
    return <Navigate to="/owner-login" state={{ from: location }} replace />;
  }

  // If user exists but no owner profile is found
  if (!profile) {
    console.log("OWNER_PROTECTED_ROUTE: No owner profile found, redirecting to registration");
    return <Navigate to="/owner-register" replace />;
  }

  console.log("OWNER_PROTECTED_ROUTE: Access granted for", user.email);
  return <>{children}</>;
};

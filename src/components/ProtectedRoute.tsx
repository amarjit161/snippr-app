import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export const ProtectedRoute = () => {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
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

  return <Outlet />;
};

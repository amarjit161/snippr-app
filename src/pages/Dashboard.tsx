import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const Dashboard = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F9FAFB] dark:bg-[#09090B]">
        <div className="h-6 w-6 animate-spin rounded-full border-[2.5px] border-zinc-200 border-t-zinc-900 dark:border-zinc-800 dark:border-t-zinc-50" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F9FAFB] p-4 dark:bg-[#09090B]">
      <div className="w-full max-w-[400px] overflow-hidden rounded-2xl bg-white p-8 shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-zinc-100 text-center space-y-4 dark:bg-zinc-900 dark:border-zinc-800">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Welcome to Dashboard
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          You have successfully logged in.
        </p>
      </div>
    </div>
  );
};

export default Dashboard;

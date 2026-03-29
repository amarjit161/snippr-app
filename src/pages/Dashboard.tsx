import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

const Dashboard = () => {
  const { user, signOut } = useAuth();

  const handleLogout = async () => {
    // AuthContext's signOut invokes Supabase sign out
    // The ProtectedRoute boundary will detect the session loss and automatically redirect to /auth
    await signOut();
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F9FAFB] p-4 dark:bg-[#09090B]">
      <div className="w-full max-w-[400px] overflow-hidden rounded-2xl bg-white p-8 shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-zinc-100 text-center space-y-6 dark:bg-zinc-900 dark:border-zinc-800">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Welcome to Dashboard
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            You have successfully logged in as <br/>
            <span className="font-medium text-zinc-900 dark:text-zinc-200">{user?.email || "User"}</span>
          </p>
        </div>
        
        <div className="pt-2 w-full">
          <Button 
            onClick={handleLogout} 
            variant="outline" 
            className="w-full h-11 rounded-xl text-red-600 hover:text-red-700 hover:bg-red-50 border-red-100 transition-colors dark:border-red-900/30 dark:hover:bg-red-950/30"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

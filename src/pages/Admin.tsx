import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import AdminDashboard from "@/components/AdminDashboard";
import Header from "@/components/Header";

const Admin = () => {
  const { user, profile, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate("/auth?role=owner");
      } else if (profile && profile.role !== "salon_owner") {
        navigate("/register");
      }
    }
  }, [user, profile, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header
        onSignOut={signOut}
        userName={user.email ?? user.phone ?? "User"}
        onAdminToggle={() => {}}
        isAdmin={true}
      />
      <main className="container py-8 space-y-8 pb-32">
        <AdminDashboard onBack={() => navigate("/salons")} />
      </main>
    </div>
  );
};

export default Admin;

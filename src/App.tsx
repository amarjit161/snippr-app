import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";
import Verify from "./pages/Verify.tsx";
import Salons from "./pages/Salons.tsx";
import Admin from "./pages/Admin.tsx";
import OwnerRegistration from "./pages/OwnerRegistration.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import SalonPage from "./pages/SalonPage.tsx";
import NotFound from "./pages/NotFound.tsx";
import { ProtectedRoute } from "./components/ProtectedRoute.tsx";
import OwnerLogin from "./pages/OwnerLogin.tsx";
import OwnerSignUp from "./pages/OwnerSignUp.tsx";
import VerifyEmail from "./pages/VerifyEmail.tsx";
import Onboarding from "./pages/Onboarding.tsx";
import RegisterSalon from "./pages/RegisterSalon.tsx";
import OwnerDashboard from "./pages/OwnerDashboard.tsx";
import OwnerRegister from "./pages/OwnerRegister.tsx";
import SalonProfile from "./pages/SalonProfile.tsx";
import Settings from "./pages/Settings.tsx";
import Services from "./pages/Services.tsx";
import Team from "./pages/Team.tsx";
import Queue from "./pages/Queue.tsx";
import Careers from "./pages/Careers.tsx";
import HowItWorks from "./pages/HowItWorks.tsx";
import Support from "./pages/Support.tsx";
import Privacy from "./pages/Privacy.tsx";
import { OwnerProtectedRoute } from "./components/OwnerProtectedRoute.tsx";

import { useAuth } from "@/contexts/AuthContext";
import { ErrorBoundary } from "./components/errors/ErrorBoundary";
import { OfflineBanner } from "./components/errors/OfflineBanner";

const queryClient = new QueryClient();

const RootLoadingGuard = ({ children }: { children: React.ReactNode }) => {
  const { loading } = useAuth();

  if (loading) {
    console.log("APP_LOADING");
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="relative flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-zinc-200 border-t-primary" />
          <p className="animate-pulse text-xs font-medium text-zinc-500">Initializing Experience...</p>
        </div>
      </div>
    );
  }

  console.log("APP_READY");
  return <>{children}</>;
};

const App = () => (
  <ErrorBoundary>
    <OfflineBanner />
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RootLoadingGuard>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<Auth />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/verify" element={<Verify />} />
                <Route path="/owner-login" element={<OwnerLogin />} />
                <Route path="/owner-signup" element={<OwnerSignUp />} />
                <Route path="/verify-email" element={<VerifyEmail />} />
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="/owner-register" element={<OwnerRegistration />} />
                <Route path="/careers" element={<Careers />} />
                <Route path="/how-it-works" element={<HowItWorks />} />
                <Route path="/support" element={<Support />} />
                <Route path="/privacy" element={<Privacy />} />

                <Route path="/register-salon" element={<OwnerProtectedRoute><RegisterSalon /></OwnerProtectedRoute>} />
                <Route path="/owner-dashboard" element={<OwnerProtectedRoute><OwnerDashboard /></OwnerProtectedRoute>} />
                <Route path="/dashboard" element={<OwnerProtectedRoute><OwnerDashboard /></OwnerProtectedRoute>} />
                <Route path="/queue" element={<OwnerProtectedRoute><Queue /></OwnerProtectedRoute>} />
                <Route path="/services" element={<OwnerProtectedRoute><Services /></OwnerProtectedRoute>} />
                <Route path="/team" element={<OwnerProtectedRoute><Team /></OwnerProtectedRoute>} />
                <Route path="/salon-profile" element={<OwnerProtectedRoute><SalonProfile /></OwnerProtectedRoute>} />
                <Route path="/settings" element={<OwnerProtectedRoute><Settings /></OwnerProtectedRoute>} />
                <Route path="/edit-salon" element={<OwnerProtectedRoute><SalonProfile /></OwnerProtectedRoute>} />
                
                <Route element={<ProtectedRoute />}>
                  <Route path="/register" element={<OwnerRegistration />} />
                  <Route path="/salons" element={<Salons />} />
                  <Route path="/salon/:id" element={<SalonPage />} />
                  <Route path="/admin" element={<Admin />} />
                  <Route path="/bookings" element={<Dashboard />} />
                </Route>
                
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </RootLoadingGuard>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;

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
import RegisterSalon from "./pages/RegisterSalon.tsx";
import OwnerDashboard from "./pages/OwnerDashboard.tsx";
import OwnerRegister from "./pages/OwnerRegister.tsx";
import SalonProfile from "./pages/SalonProfile.tsx";
import Settings from "./pages/Settings.tsx";
import Services from "./pages/Services.tsx";
import Team from "./pages/Team.tsx";
import Queue from "./pages/Queue.tsx";
import Careers from "./pages/Careers.tsx";
import { OwnerProtectedRoute } from "./components/OwnerProtectedRoute.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
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
            <Route path="/owner-register" element={<OwnerRegister />} />
            <Route path="/careers" element={<Careers />} />

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
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";

// Eager load critical pages
import Index from "./pages/Index.tsx";
import CustomerLogin from "./pages/CustomerLogin.tsx";
import CustomerRegister from "./pages/CustomerRegister.tsx";
import CompleteProfile from "./pages/CompleteProfile.tsx";
import ForgotPassword from "./pages/ForgotPassword.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import NotFound from "./pages/NotFound.tsx";
import Auth from "./pages/Auth.tsx";
import AuthCallback from "./pages/AuthCallback.tsx";

// Lazy load non-critical pages
const Verify = lazy(() => import("./pages/Verify.tsx"));
const Salons = lazy(() => import("./pages/Salons.tsx"));
const Admin = lazy(() => import("./pages/Admin.tsx"));
const OwnerRegistration = lazy(() => import("./pages/OwnerRegistration.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const SalonPage = lazy(() => import("./pages/SalonPage.tsx"));
const OwnerLogin = lazy(() => import("./pages/OwnerLogin.tsx"));
const OwnerSignUp = lazy(() => import("./pages/OwnerSignUp.tsx"));
const OwnerResetPassword = lazy(() => import("./pages/OwnerResetPassword.tsx"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail.tsx"));
const Onboarding = lazy(() => import("./pages/Onboarding.tsx"));
const RegisterSalon = lazy(() => import("./pages/RegisterSalon.tsx"));
const OwnerDashboard = lazy(() => import("./pages/OwnerDashboard.tsx"));
const SalonProfile = lazy(() => import("./pages/SalonProfile.tsx"));
const Settings = lazy(() => import("./pages/Settings.tsx"));
const Services = lazy(() => import("./pages/Services.tsx"));
const Team = lazy(() => import("./pages/Team.tsx"));
const Queue = lazy(() => import("./pages/Queue.tsx"));
const Careers = lazy(() => import("./pages/Careers.tsx"));
const HowItWorks = lazy(() => import("./pages/HowItWorks.tsx"));
const Support = lazy(() => import("./pages/Support.tsx"));
const Privacy = lazy(() => import("./pages/Privacy.tsx"));
const ProfileCompletion = lazy(() => import("./pages/ProfileCompletion.tsx"));
const MyProfile = lazy(() => import("./pages/MyProfile.tsx"));

import { ProtectedRoute } from "./components/ProtectedRoute.tsx";
import { OwnerProtectedRoute } from "./components/OwnerProtectedRoute.tsx";
import { useAuth } from "@/contexts/AuthContext";
import { ErrorBoundary } from "./components/errors/ErrorBoundary";
import { OfflineBanner } from "./components/errors/OfflineBanner";
import { useTawkTo } from "@/hooks/useTawkTo";

// Optimized QueryClient with better caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

const RootLoadingGuard = ({ children }: { children: React.ReactNode }) => {
  const { loading } = useAuth();

  if (loading) {
    if (import.meta.env.DEV) console.log("APP_LOADING");
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="relative flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-zinc-200 border-t-primary" />
          <p className="animate-pulse text-xs font-medium text-zinc-500">Initializing Experience...</p>
        </div>
      </div>
    );
  }

  if (import.meta.env.DEV) console.log("APP_READY");
  return <>{children}</>;
};

// Loading component for lazy routes
const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <div className="relative flex flex-col items-center gap-4">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-primary" />
    </div>
  </div>
);

const AppRoutes = () => {
  useTawkTo();

  return (
    <Routes>
      {/* Critical pages - No suspension */}
      <Route path="/" element={<Index />} />
      <Route path="/login" element={<CustomerLogin />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/register" element={<CustomerRegister />} />
      <Route path="/complete-profile" element={<CompleteProfile />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="*" element={<NotFound />} />

      {/* Lazy-loaded pages with Suspense */}
      <Route path="/profile-completion" element={<Suspense fallback={<PageLoader />}><ProfileCompletion /></Suspense>} />
      <Route path="/verify" element={<Suspense fallback={<PageLoader />}><Verify /></Suspense>} />
      <Route path="/owner-login" element={<Suspense fallback={<PageLoader />}><OwnerLogin /></Suspense>} />
      <Route path="/owner-signup" element={<Suspense fallback={<PageLoader />}><OwnerSignUp /></Suspense>} />
      <Route path="/owner-reset-password" element={<Suspense fallback={<PageLoader />}><OwnerResetPassword /></Suspense>} />
      <Route path="/verify-email" element={<Suspense fallback={<PageLoader />}><VerifyEmail /></Suspense>} />
      <Route path="/onboarding" element={<Suspense fallback={<PageLoader />}><Onboarding /></Suspense>} />
      <Route path="/owner-register" element={<Suspense fallback={<PageLoader />}><OwnerRegistration /></Suspense>} />
      <Route path="/careers" element={<Suspense fallback={<PageLoader />}><Careers /></Suspense>} />
      <Route path="/how-it-works" element={<Suspense fallback={<PageLoader />}><HowItWorks /></Suspense>} />
      <Route path="/support" element={<Suspense fallback={<PageLoader />}><Support /></Suspense>} />
      <Route path="/privacy" element={<Suspense fallback={<PageLoader />}><Privacy /></Suspense>} />

      {/* Owner protected routes */}
      <Route path="/register-salon" element={<Suspense fallback={<PageLoader />}><OwnerProtectedRoute><RegisterSalon /></OwnerProtectedRoute></Suspense>} />
      <Route path="/owner-dashboard" element={<Suspense fallback={<PageLoader />}><OwnerProtectedRoute><OwnerDashboard /></OwnerProtectedRoute></Suspense>} />
      <Route path="/dashboard" element={<Suspense fallback={<PageLoader />}><OwnerProtectedRoute><OwnerDashboard /></OwnerProtectedRoute></Suspense>} />
      <Route path="/queue" element={<Suspense fallback={<PageLoader />}><OwnerProtectedRoute><Queue /></OwnerProtectedRoute></Suspense>} />
      <Route path="/services" element={<Suspense fallback={<PageLoader />}><OwnerProtectedRoute><Services /></OwnerProtectedRoute></Suspense>} />
      <Route path="/team" element={<Suspense fallback={<PageLoader />}><OwnerProtectedRoute><Team /></OwnerProtectedRoute></Suspense>} />
      <Route path="/salon-profile" element={<Suspense fallback={<PageLoader />}><OwnerProtectedRoute><SalonProfile /></OwnerProtectedRoute></Suspense>} />
      <Route path="/settings" element={<Suspense fallback={<PageLoader />}><OwnerProtectedRoute><Settings /></OwnerProtectedRoute></Suspense>} />
      <Route path="/edit-salon" element={<Suspense fallback={<PageLoader />}><OwnerProtectedRoute><SalonProfile /></OwnerProtectedRoute></Suspense>} />

      {/* Customer protected routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/salons" element={<Suspense fallback={<PageLoader />}><Salons /></Suspense>} />
        <Route path="/salon/:id" element={<Suspense fallback={<PageLoader />}><SalonPage /></Suspense>} />
        <Route path="/admin" element={<Suspense fallback={<PageLoader />}><Admin /></Suspense>} />
        <Route path="/bookings" element={<Suspense fallback={<PageLoader />}><Dashboard /></Suspense>} />
        <Route path="/my-profile" element={<Suspense fallback={<PageLoader />}><MyProfile /></Suspense>} />
      </Route>
    </Routes>
  );
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
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <AppRoutes />
            </BrowserRouter>
          </TooltipProvider>
        </RootLoadingGuard>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;

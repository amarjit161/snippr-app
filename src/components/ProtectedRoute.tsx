import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RETURN_PATH_STORAGE_KEY, withReturnPath } from "@/lib/returnPath";

// How long to wait for AuthContext to pick up a session Supabase has already stored.
// AuthContext applies auth events after a 300ms debounce, so a sign-in that navigates
// here straight away arrives before the context has the session.
const STORED_SESSION_GRACE_MS = 3000;

export const ProtectedRoute = () => {
  const { session, loading } = useAuth();
  const location = useLocation();
  const [profileComplete, setProfileComplete] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);
  // Supabase's own stored session while the context has none: "pending" (checking),
  // "found" (wait for the context to catch up), "none" (signed out — redirect).
  const [storedSession, setStoredSession] = useState<"pending" | "found" | "none">("pending");

  useEffect(() => {
    if (loading || session) return;

    let cancelled = false;
    const settle = (next: "found" | "none") => {
      if (!cancelled) setStoredSession(next);
    };
    // Bounded: a stored session the context never picks up (or a getSession() that
    // never settles) ends in the normal redirect instead of an endless spinner.
    const timer = setTimeout(() => settle("none"), STORED_SESSION_GRACE_MS);

    Promise.resolve()
      .then(() => supabase.auth.getSession())
      .then(
        ({ data }) => {
          if (data?.session) {
            settle("found");
          } else {
            clearTimeout(timer);
            settle("none");
          }
        },
        () => {
          clearTimeout(timer);
          settle("none");
        },
      );

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [loading, session]);

  useEffect(() => {
    const checkProfileCompletion = async () => {
      if (!session?.user) {
        if (import.meta.env.DEV) console.log("PROTECTED_ROUTE: No session user");
        setCheckingProfile(false);
        return;
      }

      try {
        const fetchPromise = supabase
          .from('customer_profiles')
          .select('phone, gender')
          .eq('id', session.user.id)
          .maybeSingle();

        const timeoutPromise = new Promise<any>((_, reject) => 
          setTimeout(() => reject(new Error("Profile check timeout")), 5000)
        );

        const { data: profile } = await Promise.race([fetchPromise, timeoutPromise]);

        if (import.meta.env.DEV) console.log("PROTECTED_ROUTE: Profile check", { 
          userId: session.user.id, 
          phone: profile?.phone ? "✓ Set" : "✗ Not set",
          gender: profile?.gender ? "✓ Set" : "✗ Not set",
          canAccess: !!profile?.phone
        });

        // Profile is sufficient for booking if phone is set (gender is optional)
        if (profile?.phone) {
          if (import.meta.env.DEV) console.log("PROTECTED_ROUTE: Profile sufficient ✓");
          setProfileComplete(true);
        } else {
          if (import.meta.env.DEV) console.log("PROTECTED_ROUTE: Profile incomplete ✗ - Phone not set");
          setProfileComplete(false);
        }
      } catch (err) {
        if (import.meta.env.DEV) console.error('PROTECTED_ROUTE: Error checking profile completion:', err);
        setProfileComplete(false);
      } finally {
        setCheckingProfile(false);
      }
    };

    checkProfileCompletion();
  }, [session?.user?.id]);

  // Also wait while a just-signed-in session is on its way to the context, so the
  // customer isn't sent back to /auth with a valid session already stored.
  if (loading || checkingProfile || (!session && storedSession !== "none")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F9FAFB] dark:bg-[#09090B]">
        <div className="h-6 w-6 animate-spin rounded-full border-[2.5px] border-zinc-200 border-t-zinc-900 dark:border-zinc-800 dark:border-t-zinc-50" />
      </div>
    );
  }

  if (!session) {
    const redirectPath = `${location.pathname}${location.search}${location.hash}`;
    try {
      localStorage.setItem(RETURN_PATH_STORAGE_KEY, redirectPath);
    } catch {
      // storage blocked — ?next= below still carries the destination
    }
    // Also passed as a validated ?next=, so it survives blocked storage and is handed on
    // by the sign-in page (Create account, Google, phone OTP, profile completion).
    return <Navigate to={withReturnPath("/auth", redirectPath)} state={{ from: location }} replace />;
  }

  // We no longer aggressively redirect to /profile-completion.
  // Users can browse salons and book using manual entry, or use the ProfileCompletionBanner.
  // if (!profileComplete && location.pathname !== "/profile-completion") {
  //   return <Navigate to="/profile-completion" replace />;
  // }

  return <Outlet />;
};


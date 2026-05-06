import { createContext, useContext, useEffect, useState, ReactNode, useRef } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { debug } from "@/lib/debug";
import type { Tables } from "@/integrations/supabase/types";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Tables<"owners"> | null;
  loading: boolean;
  profileLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  profileLoading: false,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Tables<"owners"> | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const cachedProfileRef = useRef<Tables<"owners"> | null>(null); // Cache profile to avoid re-fetching
  const visibilityChangeTimeRef = useRef(0); // Track when visibility changed
  const lastProfileFetchSessionIdRef = useRef<string | null>(null);
  const profileFetchInFlightRef = useRef<string | null>(null);

  const readStoredOwnerProfile = () => {
    if (typeof window === "undefined") return null;

    try {
      const raw = localStorage.getItem("owner");
      if (!raw) return null;

      return JSON.parse(raw) as Tables<"owners">;
    } catch {
      return null;
    }
  };

  const isOwnerIntent = (s: Session | null) => {
    if (typeof window === "undefined") return false;
    return (
      s?.user?.user_metadata?.role === "owner" ||
      localStorage.getItem("snippr_role") === "owner" ||
      Boolean(localStorage.getItem("owner"))
    );
  };

  // Helper for internal auth queries to prevent hanging
  const supabaseWithTimeout = async (query: any, timeoutMs = 8000) => {
    const timeout = new Error("AUTH_QUERY_TIMEOUT");
    const promise = new Promise((_, reject) => setTimeout(() => reject(timeout), timeoutMs));
    return Promise.race([query, promise]) as any;
  };

  useEffect(() => {
    const fetchProfile = async (s: Session | null, forceRefresh = false) => {
      const sessionId = s?.user?.id ?? null;
      if (!sessionId) {
        setProfile(null);
        cachedProfileRef.current = null;
        lastProfileFetchSessionIdRef.current = null;
        setProfileLoading(false);
        return;
      }

      // Check if we already have a fetch in flight for this user
      if (profileFetchInFlightRef.current === sessionId && !forceRefresh) return;

      // Skip if it's a customer (not owner) and we already checked
      if (!forceRefresh && lastProfileFetchSessionIdRef.current === sessionId) {
        if (cachedProfileRef.current) setProfile(cachedProfileRef.current);
        return;
      }

      if (!isOwnerIntent(s)) {
        console.log("FETCH_PROFILE_SKIPPED: Not an owner intent");
        setProfile(null);
        lastProfileFetchSessionIdRef.current = sessionId;
        setProfileLoading(false);
        return;
      }

      profileFetchInFlightRef.current = sessionId;
      setProfileLoading(true);

      const storedOwner = readStoredOwnerProfile();
      if (storedOwner?.id === sessionId && !profile) {
        setProfile(storedOwner); // Fast bootstrap
      }

      try {
        const { data, error } = await supabaseWithTimeout(
          supabase.from("owners").select("*").eq("id", sessionId).maybeSingle()
        );

        if (error) throw error;

        const resolvedProfile = data ?? null;
        cachedProfileRef.current = resolvedProfile;
        setProfile(resolvedProfile);
        lastProfileFetchSessionIdRef.current = sessionId;
        
        if (resolvedProfile) {
          localStorage.setItem("owner", JSON.stringify(resolvedProfile));
        }
      } catch (err: any) {
        console.error("FETCH_PROFILE_ERROR:", err.message);
        // Fallback to cache or stored
        if (cachedProfileRef.current) setProfile(cachedProfileRef.current);
        else if (storedOwner?.id === sessionId) setProfile(storedOwner);
      } finally {
        profileFetchInFlightRef.current = null;
        setProfileLoading(false);
      }
    };

    const initAuth = async () => {
      try {
        const { data: { session: initialSession } } = await supabaseWithTimeout(supabase.auth.getSession(), 10000);
        console.log("SESSION_ON_LOAD:", initialSession ? "Active" : "None");
        setSession(initialSession);
        if (initialSession) {
          const storedOwner = readStoredOwnerProfile();
          if (storedOwner?.id === initialSession.user.id) {
            cachedProfileRef.current = storedOwner;
            setProfile(storedOwner);
          }
          await fetchProfile(initialSession);
        }
      } catch (err) {
        console.error("SESSION_INITIALIZATION_ERROR:", err);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Track visibility changes to prevent profile refetch on tab switch
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log("PAGE_HIDDEN: Recording timestamp");
      } else {
        console.log("PAGE_VISIBLE: Recording timestamp");
        visibilityChangeTimeRef.current = Date.now();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Failsafe timer: Ensure app unblocks after 5 seconds regardless of auth response
    const failsafe = setTimeout(() => {
      setLoading((currentLoading) => {
        if (currentLoading) {
          console.warn("FORCE_UNBLOCK_LOADING: Auth initialization took too long.");
          return false;
        }
        return false;
      });
    }, 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        console.log("AUTH_STATE_CHANGED:", event, currentSession?.user?.email || "No session");

        if (event === "TOKEN_REFRESHED") {
          console.log("AUTH: Token refreshed successfully");
        }

        if (event === "SIGNED_OUT") {
          setSession(null);
          setProfile(null);
          cachedProfileRef.current = null;
          lastProfileFetchSessionIdRef.current = null;
          profileFetchInFlightRef.current = null;
          localStorage.removeItem("snippr_role");
          localStorage.removeItem("owner");
          setLoading(false);
          return;
        }

        if (event === "USER_UPDATED") {
          if (currentSession) {
            await fetchProfile(currentSession, true);
          }
          return;
        }

        setSession(currentSession);
        setLoading(false); // Resolve loading on any state change

        // Auto-create customer profile on first sign-in if it doesn't exist
        if (event === 'SIGNED_IN' && currentSession?.user) {
          try {
            const { data: existingProfile } = await supabaseWithTimeout(
              supabase.from('customer_profiles').select('id').eq('id', currentSession.user.id).maybeSingle()
            );

            if (!existingProfile) {
              // Create empty profile for new customer
              const { error } = await supabaseWithTimeout(
                supabase.from('customer_profiles').insert([{
                  id: currentSession.user.id,
                  email: currentSession.user.email || '',
                  profile_complete_pct: 20, // Email only = 20%
                }])
              );

              if (import.meta.env.DEV && error) console.log('Auto-create profile:', error);
            }
          } catch (err) {
            if (import.meta.env.DEV) console.error('Error auto-creating profile:', err);
          }
        }
        
        // Check if this is likely a visibility change event (within 1 second of visibility becoming visible)
        const isVisibilityChangeEvent = Date.now() - visibilityChangeTimeRef.current < 1000;
        
        // Only fetch/refetch profile on initial sign in, not on every token refresh
        if (event === "SIGNED_IN" && currentSession) {
          // Auto-create customer profile if SSO login and no profile exists
          if (currentSession.user) {
            const { data: existing } = await supabaseWithTimeout(
              supabase.from('customer_profiles').select('id').eq('id', currentSession.user.id).maybeSingle()
            );
            
            if (!existing) {
              console.log("AUTH_SSO: Creating auto-profile for new SSO user");
              // New SSO user — create profile from Google data
              const meta = currentSession.user.user_metadata;
              try {
                await supabaseWithTimeout(
                  supabase.from('customer_profiles').insert({
                    id: currentSession.user.id,
                    first_name: meta?.full_name?.split(' ')[0] || meta?.name?.split(' ')[0] || '',
                    last_name: meta?.full_name?.split(' ').slice(1).join(' ') || '',
                    email: currentSession.user.email,
                    phone: null, // will be collected via PhoneVerifyModal
                    gender: null, // will be collected in profile completion
                  })
                );
              } catch (err) {
                console.error("AUTH_SSO: Failed to create profile", err);
              }
            }
          }
          
          // Skip refetch if this was triggered by visibility change & we already have cached profile
          if ((isVisibilityChangeEvent && cachedProfileRef.current) || lastProfileFetchSessionIdRef.current === currentSession.user.id) {
            console.log("AUTH_STATE: Skipping refetch due to visibility change, using cache");
            setProfile(cachedProfileRef.current);
          } else {
            await fetchProfile(currentSession, true); // Force refresh on sign in
          }
        } else if (event === "INITIAL_SESSION" && currentSession) {
          await fetchProfile(currentSession, false); // Use cache for initial session
        }
        // Don't refetch on TOKEN_REFRESHED or other events - use cached profile
      }
    );

    return () => {
      clearTimeout(failsafe);
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const signOut = async () => {
    console.log("🚪 LOGOUT_INITIATED");
    try {
      // Clear local state first to prevent any more API calls
      setSession(null);
      setProfile(null);
      cachedProfileRef.current = null;
      lastProfileFetchSessionIdRef.current = null;
      profileFetchInFlightRef.current = null;
      localStorage.removeItem("snippr_role");
      localStorage.removeItem("owner");
      localStorage.removeItem("snippet_customer_profile");
      
      console.log("🚪 LOCAL_STATE_CLEARED");
      
      // Now sign out from Supabase
      await supabase.auth.signOut();
      
      console.log("✅ LOGOUT_COMPLETE");
    } catch (err) {
      console.error("❌ LOGOUT_ERROR", err);
      // Even if logout fails, clear local state
      setSession(null);
      setProfile(null);
      cachedProfileRef.current = null;
      localStorage.removeItem("snippr_role");
      localStorage.removeItem("owner");
    }
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, profile, loading, profileLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

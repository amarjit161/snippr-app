import { createContext, useContext, useEffect, useState, ReactNode, useRef } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
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

  useEffect(() => {
    const fetchProfile = async (s: Session | null, forceRefresh = false) => {
      const sessionId = s?.user?.id ?? null;

      if (sessionId) {
        if (profileFetchInFlightRef.current === sessionId) {
          return;
        }

        if (!forceRefresh && lastProfileFetchSessionIdRef.current === sessionId) {
          if (cachedProfileRef.current) {
            console.log("FETCH_PROFILE: Using cached profile");
            setProfile(cachedProfileRef.current);
          }
          return;
        }

        profileFetchInFlightRef.current = sessionId;

        if (!isOwnerIntent(s)) {
          console.log("FETCH_PROFILE_SKIPPED: customer session, not querying owners table");
          cachedProfileRef.current = null;
          setProfile(null);
          lastProfileFetchSessionIdRef.current = sessionId;
          profileFetchInFlightRef.current = null;
          setProfileLoading(false);
          return;
        }

        // If we have a cached profile and not forcing refresh, use cache
        if (cachedProfileRef.current && !forceRefresh) {
          console.log("FETCH_PROFILE: Using cached profile");
          setProfile(cachedProfileRef.current);
          lastProfileFetchSessionIdRef.current = sessionId;
          profileFetchInFlightRef.current = null;
          return;
        }

        console.log("FETCH_PROFILE_START", sessionId);
        setProfileLoading(true);

        const storedOwner = readStoredOwnerProfile();
        if (storedOwner?.id === sessionId) {
          console.log("FETCH_PROFILE: Using stored owner profile as immediate bootstrap");
          cachedProfileRef.current = storedOwner;
          setProfile(storedOwner);
        }
        
        try {
          console.log("FETCH_PROFILE: Requesting from database...");
          
          // Create a promise that times out after 15 seconds (for network issues)
          const fetchWithTimeout = async () => {
            return Promise.race([
              supabase
                .from("owners")
                .select("*")
                .eq("id", sessionId)
                .maybeSingle(),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Query timeout after 15s")), 15000)
              ),
            ]);
          };

          const { data, error } = (await fetchWithTimeout()) as any;

          // maybeSingle() returns null if no row found — this is not an error for customers
          if (!error) {
            console.log("FETCH_PROFILE_COMPLETE:", data ?? "null (customer user, not owner)");
            const resolvedProfile = data ?? storedOwner ?? null;
            cachedProfileRef.current = resolvedProfile;
            setProfile(resolvedProfile);
            lastProfileFetchSessionIdRef.current = sessionId;
            setProfileLoading(false);
            return;
          }

          // Only retry on actual network/timeout errors
          console.error("FETCH_PROFILE_ERROR:", error.message);
          if (cachedProfileRef.current) {
            setProfile(cachedProfileRef.current);
          } else if (storedOwner?.id === sessionId) {
            console.log("FETCH_PROFILE: Falling back to stored owner profile after error");
            cachedProfileRef.current = storedOwner;
            setProfile(storedOwner);
          } else {
            setProfile(null);
          }
        } catch (err: any) {
          console.error("FETCH_PROFILE_EXCEPTION:", err.message || err);
          if (cachedProfileRef.current) {
            console.log("FETCH_PROFILE: Falling back to cached profile");
            setProfile(cachedProfileRef.current);
          } else if (storedOwner?.id === sessionId) {
            console.log("FETCH_PROFILE: Falling back to stored owner profile after exception");
            cachedProfileRef.current = storedOwner;
            setProfile(storedOwner);
          } else {
            setProfile(null);
          }
        } finally {
          profileFetchInFlightRef.current = null;
          setProfileLoading(false);
        }
      } else {
        setProfile(null);
        cachedProfileRef.current = null;
        lastProfileFetchSessionIdRef.current = null;
        profileFetchInFlightRef.current = null;
        setProfileLoading(false);
      }
    };

    const initAuth = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
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
        
        // Check if this is likely a visibility change event (within 1 second of visibility becoming visible)
        const isVisibilityChangeEvent = Date.now() - visibilityChangeTimeRef.current < 1000;
        
        // Only fetch/refetch profile on initial sign in, not on every token refresh
        if (event === "SIGNED_IN" && currentSession) {
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
    console.log("LOGOUT_INITIATED");
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    cachedProfileRef.current = null;
    localStorage.removeItem("snippr_role");
    localStorage.removeItem("owner");
  };

  useEffect(() => {
    if (!session?.user || typeof window === "undefined") return;

    const tawk = (window as any).Tawk_API;
    if (!tawk) return;

    const setVisitor = () => {
      tawk.setAttributes?.(
        {
          name: profile?.name || session.user.email?.split("@")[0] || "Customer",
          email: session.user.email || "",
          hash: "",
        },
        (error: any) => {
          if (error) console.log("Tawk setAttributes error:", error);
        }
      );
    };

    if (typeof tawk.setAttributes === "function") {
      setVisitor();
    } else {
      tawk.onLoad = setVisitor;
    }
  }, [session?.user, profile]);

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, profile, loading, profileLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

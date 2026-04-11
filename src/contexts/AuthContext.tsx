import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Tables<"owners"> | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Tables<"owners"> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async (s: Session | null) => {
      if (s?.user) {
        console.log("FETCH_PROFILE_START", s.user.id);
        const { data, error } = await supabase
          .from("owners")
          .select("*")
          .eq("id", s.user.id)
          .maybeSingle();

        if (error) {
          console.warn("FETCH_PROFILE_ERROR:", error.message);
          setProfile(null);
        } else {
          console.log("FETCH_PROFILE_COMPLETE:", data ? "Profile Found" : "No Profile Found");
          setProfile(data ?? null);
        }
      } else {
        setProfile(null);
      }
    };

    const initAuth = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        console.log("SESSION_ON_LOAD:", initialSession ? "Active" : "None");
        setSession(initialSession);
        if (initialSession) {
          await fetchProfile(initialSession);
        }
      } catch (err) {
        console.error("SESSION_INITIALIZATION_ERROR:", err);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

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
        setSession(currentSession);
        setLoading(false); // Resolve loading on any state change
        
        if (event === "SIGNED_IN") {
          await fetchProfile(currentSession);
        } else if (event === "SIGNED_OUT") {
          setProfile(null);
          localStorage.removeItem("snippr_role");
          localStorage.removeItem("owner");
        }
      }
    );

    return () => {
      clearTimeout(failsafe);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    console.log("LOGOUT_INITIATED");
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    localStorage.removeItem("snippr_role");
    localStorage.removeItem("owner");
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

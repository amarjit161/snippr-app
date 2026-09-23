import { createContext, useContext, useEffect, useState, ReactNode, useRef } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { debug } from "@/lib/debug";
import type { Tables } from "@/integrations/supabase/types";
import {
  clearAllSessionRecords,
  clearOtherSessionRecords,
  registerCurrentSession,
  removeCurrentSessionRecord,
  touchCurrentSession,
} from "@/lib/sessionRegistry";

// Heartbeat cadence for the active-session registry — frequent enough that
// "last active" stays meaningful, infrequent enough to not spam the DB.
const SESSION_HEARTBEAT_MS = 5 * 60 * 1000;

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Tables<"owners"> | null;
  loading: boolean;
  profileLoading: boolean;
  signOut: () => Promise<void>;
  /**
   * Ends every OTHER session for this account (other browsers/devices) while
   * leaving the current session signed in. Supabase does not fire a
   * SIGNED_OUT event for this scope, and does not expose which/how many
   * other sessions existed — see signOutOtherDevices' own comment.
   */
  signOutOtherDevices: () => Promise<{ error: string | null }>;
  /** Ends every session for this account, including this one, and redirects to login. */
  signOutEverywhere: () => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  profileLoading: false,
  signOut: async () => {},
  signOutOtherDevices: async () => ({ error: "Not initialized" }),
  signOutEverywhere: async () => ({ error: "Not initialized" }),
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
  const logoutChannel = useRef<BroadcastChannel | null>(null);
  const authStateDebounceRef = useRef<NodeJS.Timeout | null>(null); // Debounce auth state changes
  const lastAuthStateChangeRef = useRef<string | null>(null); // Prevent duplicate auth state processing
  const lastTokenRefreshTimeRef = useRef<number>(0); // Track last token refresh to prevent spam

  useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;

    logoutChannel.current = new BroadcastChannel("snippr_auth");
    logoutChannel.current.onmessage = (event) => {
      if (event.data === "SIGNED_OUT") {
        setSession(null);
        setProfile(null);
        cachedProfileRef.current = null;
        lastProfileFetchSessionIdRef.current = null;
        profileFetchInFlightRef.current = null;
        localStorage.removeItem("snippr_role");
        localStorage.removeItem("owner");
        window.location.href = "/login";
      }
    };

    return () => logoutChannel.current?.close();
  }, []);

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
  const supabaseWithTimeout = async (query: any, timeoutMs = 20000) => {
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
          supabase.from("owners").select("id, name, email, phone, created_at").eq("id", sessionId).maybeSingle()
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
      if (!document.hidden) {
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
        const stateKey = `${event}:${currentSession?.user?.id ?? "null"}`;
        
        // Prevent duplicate processing of same auth state change within 500ms
        if (lastAuthStateChangeRef.current === stateKey) {
          return;
        }

        lastAuthStateChangeRef.current = stateKey;

        // Debounce rapid auth state changes (e.g., token refresh spam)
        if (authStateDebounceRef.current) {
          clearTimeout(authStateDebounceRef.current);
        }

        authStateDebounceRef.current = setTimeout(async () => {
          try {
            if (event === "TOKEN_REFRESHED") {
              // Prevent token refresh spam - only allow one refresh every 30 seconds
              const now = Date.now();
              if (now - lastTokenRefreshTimeRef.current < 30000) {
                console.log("AUTH: Token refresh throttled (last refresh <30s ago)");
                return;
              }
              lastTokenRefreshTimeRef.current = now;
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
          } catch (err) {
            console.error("AUTH_STATE_CHANGE_HANDLER_ERROR:", err);
          }
        }, 300); // Debounce by 300ms to batch rapid changes
      }
    );

    return () => {
      clearTimeout(failsafe);
      if (authStateDebounceRef.current) {
        clearTimeout(authStateDebounceRef.current);
      }
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const signOut = async () => {
    console.log("LOGOUT_INITIATED");
    const userId = session?.user?.id;
    try {
      // scope: 'local' — sign out of THIS browser only. Supabase's signOut()
      // defaults to scope: 'global', which would silently end every other
      // session for this account too; a plain "Sign Out" click should not do
      // that. Use signOutEverywhere() below for the explicit global action.
      const { error } = await supabase.auth.signOut({ scope: "local" });

      // Only remove this device's own registry row once Supabase has
      // actually confirmed (or effectively confirmed — see the error-class
      // note on signOutOtherDevices below) the sign-out. If the call itself
      // failed for an unrelated reason (e.g. a network error), leave the row
      // in place rather than have the list understate what's still live.
      if (userId && !error) {
        try {
          await removeCurrentSessionRecord(userId);
        } catch (err) {
          console.warn("SESSION_REGISTRY_CLEANUP_FAILED", err);
        }
      }

      logoutChannel.current?.postMessage("SIGNED_OUT");
    } catch (err) {
      console.error("LOGOUT_ERROR", err);
    } finally {
      // Local app state is always cleared and the user always lands on
      // /login, regardless of whether the network call above succeeded —
      // this preserves the existing "Sign Out always feels instant" UX and
      // matches how this app already treated sign-out before the session
      // registry existed. The one thing that's now conditional is the
      // registry row itself (above), not this local state reset.
      setSession(null);
      setProfile(null);
      cachedProfileRef.current = null;
      lastProfileFetchSessionIdRef.current = null;
      profileFetchInFlightRef.current = null;
      localStorage.removeItem("snippr_role");
      localStorage.removeItem("owner");
      localStorage.removeItem("snippet_customer_profile");
      window.location.href = "/login";
    }
  };

  // Supabase's client-side Auth API has no endpoint to revoke one arbitrary
  // OTHER session by id — only by scope ('others' | 'global'), or by that
  // session's own access-token JWT (which we correctly never store). So
  // "other devices" / "everywhere" below map directly onto Supabase's real
  // scoped sign-out, and the snippr_user_sessions registry (see
  // src/lib/sessionRegistry.ts) is cleared to match. Per Supabase's docs,
  // revoking a refresh token does not invalidate an already-issued access
  // token instantly — that other browser loses access once its token is
  // next refreshed/revalidated, not the moment this call returns. The UI
  // must not claim otherwise.
  const signOutOtherDevices = async (): Promise<{ error: string | null }> => {
    console.log("LOGOUT_OTHER_DEVICES_INITIATED");
    try {
      // scope: 'others' revokes every refresh token for this account except
      // the current one. Per Supabase's docs, no SIGNED_OUT event fires for
      // this scope, so the current session's local state is left untouched.
      //
      // Call this FIRST, before touching the registry. The current session
      // stays valid throughout this call either way, so there's no ordering
      // constraint forcing registry cleanup first (unlike signOutEverywhere
      // below) — and doing the real revocation first means the registry is
      // never emptied unless Supabase actually confirmed the revoke. If we
      // cleared the registry before this call and the call then failed, the
      // session list would falsely show only "this device" while every
      // other device was, in reality, still fully live.
      const { error } = await supabase.auth.signOut({ scope: "others" });
      if (error) {
        console.error("LOGOUT_OTHER_DEVICES_ERROR", error);
        return { error: error.message };
      }

      // supabase-js's own signOut({scope:'others'}) silently swallows
      // 401/403/404/session-missing errors from the underlying
      // POST /auth/v1/logout call and returns {error: null} regardless (see
      // auth-js GoTrueClient._signOut()). That happens precisely when THIS
      // session is itself already dead server-side — e.g. previously
      // revoked, but still holding a locally-cached, not-yet-expired access
      // token — because GoTrue can't act on an "others" request from a
      // session it no longer recognizes. A null `error` above is therefore
      // NOT proof the revoke happened. getUser() makes a real,
      // server-validating request (unlike getSession()), so use it to
      // confirm our own session is actually still alive before trusting
      // this as a success.
      const { error: userError } = await supabase.auth.getUser();

      if (userError) {
        console.error("LOGOUT_OTHER_DEVICES_OWN_SESSION_INVALID", userError);
        // Our own session is no longer valid server-side, so we have no way
        // to know whether "other devices" were actually revoked — do not
        // claim they were. The honest move is to finish signing this
        // already-dead session out locally (via the existing local sign-out
        // flow) rather than leave the UI implying it's still authenticated.
        await signOut();
        return { error: "Your session is no longer valid. You've been signed out." };
      }

      const userId = session?.user?.id;
      if (userId) {
        try {
          await clearOtherSessionRecords(userId);
        } catch (err) {
          console.warn("SESSION_REGISTRY_CLEANUP_FAILED", err);
        }
      }

      return { error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to sign out other devices";
      console.error("LOGOUT_OTHER_DEVICES_ERROR", err);
      return { error: message };
    }
  };

  const signOutEverywhere = async (): Promise<{ error: string | null }> => {
    console.log("LOGOUT_EVERYWHERE_INITIATED");
    try {
      const userId = session?.user?.id;
      // Unlike signOutOtherDevices, this registry cleanup CANNOT be deferred
      // until after signOut({scope:'global'}) succeeds: 'global' scope also
      // revokes THIS session, so once that call returns (successfully or
      // not — see below), this device's own JWT may no longer be accepted
      // for the RLS-protected delete on snippr_user_sessions. There is no
      // ordering that lets us "confirm success, then clean up" the way the
      // 'others' path does — clearing first is the only way this delete can
      // happen at all. We do not weaken RLS to work around this.
      //
      // Known consequence: if signOut({scope:'global'}) itself then fails
      // (e.g. a network error) after this cleanup already ran, the registry
      // will read empty even though sessions may still be live server-side.
      // That's an accepted, narrow edge case — surfaced as an error to the
      // caller below, not hidden — rather than a routine occurrence.
      if (userId) {
        try {
          await clearAllSessionRecords(userId);
        } catch (err) {
          console.warn("SESSION_REGISTRY_CLEANUP_FAILED", err);
        }
      }

      // scope: 'global' (the Supabase default) — ends this session AND every
      // other session for this account.
      const { data: signOutData, error } = await supabase.auth.signOut({ scope: "global" });

      if (import.meta.env.DEV) {
        console.log("SIGN_OUT_GLOBAL_RESULT", {
          data: signOutData,
          error: error ? { name: error.name, status: error.status, code: error.code, message: error.message } : null,
        });
      }

      if (error) {
        console.error("LOGOUT_EVERYWHERE_ERROR", error);
        return { error: error.message };
      }

      // Do NOT trust an error-free response alone as proof this session is
      // actually gone, and do NOT clear local state or redirect until we've
      // confirmed it against the SDK's own session state. This is the fix
      // for the bug where the app redirected to /login unconditionally even
      // when the underlying session was never actually cleared, leaving the
      // browser that clicked "Log out everywhere" still authenticated.
      const { data: postSignOutSession } = await supabase.auth.getSession();

      if (import.meta.env.DEV) {
        console.log("POST_SIGNOUT_SESSION_CHECK", { stillHasSession: !!postSignOutSession.session });
      }

      if (postSignOutSession.session) {
        console.error("LOGOUT_EVERYWHERE_SESSION_STILL_PRESENT: signOut() returned no error but the session is still active.");
        return { error: "Sign-out did not complete — your session is still active. Please try again." };
      }

      // Confirmed gone — safe to clear local app state and redirect now.
      setSession(null);
      setProfile(null);
      cachedProfileRef.current = null;
      lastProfileFetchSessionIdRef.current = null;
      profileFetchInFlightRef.current = null;
      localStorage.removeItem("snippr_role");
      localStorage.removeItem("owner");
      localStorage.removeItem("snippet_customer_profile");
      logoutChannel.current?.postMessage("SIGNED_OUT");
      window.location.href = "/login";
      return { error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to sign out everywhere";
      console.error("LOGOUT_EVERYWHERE_ERROR", err);
      return { error: message };
    }
  };

  useEffect(() => {
    if (!session?.user || typeof window === "undefined") return;

    const tawk = (window as any).Tawk_API;
    if (!tawk) return;

    const setVisitor = () => {
      if (!session.user.email) return;

      tawk.setAttributes?.(
        {
          name: profile?.name || session.user.email?.split("@")[0] || "Customer",
          email: session.user.email,
          hash: "",
        },
        (error: any) => {
          if (error && error !== "INVALID_EMAIL") console.log("Tawk setAttributes error:", error);
        }
      );
    };

    if (typeof tawk.setAttributes === "function") {
      setVisitor();
    } else {
      tawk.onLoad = setVisitor;
    }
  }, [session?.user, profile]);

  // Active-session registry: register this device once per session, then
  // heartbeat periodically while the tab is visible. Cleanly stopped on
  // sign-out (session becomes null) and on unmount — never left running.
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const registeredSessionUserRef = useRef<string | null>(null);
  useEffect(() => {
    const userId = session?.user?.id ?? null;

    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    if (!userId) {
      registeredSessionUserRef.current = null;
      return;
    }

    if (registeredSessionUserRef.current !== userId) {
      registeredSessionUserRef.current = userId;
      registerCurrentSession(userId);
    }

    heartbeatIntervalRef.current = setInterval(() => {
      if (document.hidden) return;
      touchCurrentSession(userId);
    }, SESSION_HEARTBEAT_MS);

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };
  }, [session?.user?.id]);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        loading,
        profileLoading,
        signOut,
        signOutOtherDevices,
        signOutEverywhere,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};


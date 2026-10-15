import { useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import {
  DEFAULT_RETURN_PATH,
  consumeStoredReturnPath,
  readStoredReturnPath,
  sanitizeReturnPath,
} from '@/lib/returnPath';

// Where an owner may continue after confirming their signup email.
const OWNER_SIGNUP_DESTINATIONS = ['/onboarding', '/owner-dashboard', '/register-salon'];
const DEFAULT_OWNER_DESTINATION = '/onboarding';

/** A safe owner route from `next`, else /onboarding. Query/hash kept for allowed routes. */
const resolveOwnerDestination = (next: string | null): string => {
  const safe = sanitizeReturnPath(next);
  if (!safe) return DEFAULT_OWNER_DESTINATION;
  const pathname = safe.split(/[?#]/)[0].toLowerCase();
  return OWNER_SIGNUP_DESTINATIONS.includes(pathname) ? safe : DEFAULT_OWNER_DESTINATION;
};

/**
 * Owner signup marks the account with role "owner"; the owners row only exists
 * once onboarding is done, so either one identifies an owner. Lookup failures
 * count as "not an owner" (the user then gets the normal customer flow).
 */
const isOwnerAccount = async (user: User): Promise<boolean> => {
  if (user.user_metadata?.role === 'owner') return true;
  try {
    const { data, error } = await supabase.from('owners').select('id').eq('id', user.id).maybeSingle();
    return !error && Boolean(data);
  } catch {
    return false;
  }
};

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { hash } = useLocation();

  useEffect(() => {
    const handleCallback = async () => {
      const flow = searchParams.get('flow');

      // Password recovery: always the reset page, never the sign-in routing
      // below. Keep the rest of the query and any tokens still in the hash.
      if (flow === 'recovery') {
        const params = new URLSearchParams(searchParams);
        params.delete('flow');
        const query = params.toString();
        navigate(`/reset-password${query ? `?${query}` : ''}${hash}`, { replace: true });
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          // Owner confirming their signup email: continue owner onboarding instead
          // of the customer profile completion (an empty customer profile may exist).
          if (flow === 'signup' && (await isOwnerAccount(session.user))) {
            navigate(resolveOwnerDestination(searchParams.get('next')), { replace: true });
            return;
          }

          // Check if profile exists
          const { data: profile } = await supabase
            .from('customer_profiles')
            .select('first_name, profile_complete_pct')
            .eq('id', session.user.id)
            .maybeSingle();

          // `next` comes from the URL, so it's untrusted: only a safe same-site
          // path is ever followed (never another origin or a sign-in page).
          const requested = sanitizeReturnPath(searchParams.get('next'));

          if (!profile?.first_name) {
            // New SSO user — collect details, then continue to where they were going.
            const destination = requested ?? readStoredReturnPath() ?? DEFAULT_RETURN_PATH;
            navigate(`/complete-profile?next=${encodeURIComponent(destination)}`);
          } else {
            // Always clear the saved path so it can't redirect a later sign-in.
            const saved = consumeStoredReturnPath();
            navigate(requested ?? saved);
          }
        } else {
          navigate('/login');
        }
      } catch (err) {
        if (import.meta.env.DEV) console.error('Auth callback error:', err);
        navigate('/login');
      }
    };

    handleCallback();
  }, [navigate, searchParams, hash]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-purple-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">Signing you in...</p>
      </div>
    </div>
  );
}

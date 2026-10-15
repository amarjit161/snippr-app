import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  DEFAULT_RETURN_PATH,
  consumeStoredReturnPath,
  readStoredReturnPath,
  sanitizeReturnPath,
} from '@/lib/returnPath';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
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
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-purple-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">Signing you in...</p>
      </div>
    </div>
  );
}


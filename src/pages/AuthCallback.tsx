import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

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

          if (!profile?.first_name) {
            // New SSO user — collect details
            navigate('/complete-profile');
          } else {
            const next = searchParams.get('next') || '/salons';
            navigate(next);
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


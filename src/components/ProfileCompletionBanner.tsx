import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';

interface ProfileData {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  gender?: string;
  profile_complete_pct?: number;
}

export default function ProfileCompletionBanner() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        if (!user) return;

        const { data } = await supabase
          .from('customer_profiles')
          .select('first_name, last_name, email, phone, gender, profile_complete_pct')
          .eq('id', user.id)
          .maybeSingle();

        setProfile(data);
      } catch (err) {
        if (import.meta.env.DEV) console.error('Error loading profile:', err);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  if (loading || !profile || profile.profile_complete_pct === 100) {
    return null;
  }

  const completion = profile.profile_complete_pct || 0;

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 p-4 mb-6 rounded-lg">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Complete your profile</h3>
          </div>
          <p className="text-sm text-gray-600 mb-3">
            Add missing details to unlock all features
          </p>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${completion}%` }}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600">{completion}% complete</span>
            <button
              onClick={() => navigate('/complete-profile')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 underline"
            >
              Complete now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Phone } from 'lucide-react';

const calculateCompletion = (fields: { firstName?: string; lastName?: string; phone?: string; gender?: string; email?: string }): number => {
  const filled = Object.values(fields).filter(Boolean).length;
  return Math.round((filled / 5) * 100);
};

export default function CompleteProfile() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other' | ''>('');
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate('/login');
          return;
        }

        setUserId(user.id);
        setUserEmail(user.email || '');

        // Auto-fill from Google metadata
        const meta = user.user_metadata;
        if (meta?.full_name) {
          const nameParts = meta.full_name.split(' ');
          setFirstName(nameParts[0] || '');
          setLastName(nameParts.slice(1).join(' ') || '');
        }

        // Load existing profile if available
        const { data: profile } = await supabase
          .from('customer_profiles')
          .select('first_name, last_name, phone, gender')
          .eq('id', user.id)
          .maybeSingle();

        if (profile) {
          setFirstName(profile.first_name || '');
          setLastName(profile.last_name || '');
          setPhone(profile.phone?.replace(/\+91/, '') || '');
          setGender(profile.gender || '');
        }
      } catch (err) {
        toast.error('Failed to load profile');
      }
    };

    loadProfile();
  }, [navigate]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!firstName || !lastName) {
      toast.error('First name and last name are required');
      return;
    }

    setLoading(true);

    try {
      if (!userId) {
        toast.error('User session expired');
        setLoading(false);
        return;
      }

      const profileData = {
        id: userId,
        first_name: firstName,
        last_name: lastName,
        email: userEmail,
        phone: phone ? `+91${phone.replace(/\D/g, '')}` : null,
        gender: gender || null,
        profile_complete_pct: calculateCompletion({ firstName, lastName, email: userEmail, phone, gender }),
      };

      const { error } = await supabase
        .from('customer_profiles')
        .upsert([profileData]);

      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }

      toast.success('Profile updated!');
      const returnTo = sessionStorage.getItem('returnTo') || '/salons';
      navigate(returnTo);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const completion = calculateCompletion({ firstName, lastName, email: userEmail, phone, gender });

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Complete your profile</h1>
          <p className="text-gray-600">Just a few details to get you started</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8 space-y-6">
          {/* Progress Bar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-600">Profile completion</span>
              <span className="text-xs font-bold text-purple-600">{completion}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-purple-600 h-2 rounded-full transition-all"
                style={{ width: `${completion}%` }}
              />
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSave} className="space-y-4">
            {/* First Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                First name *
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                disabled={loading}
              />
            </div>

            {/* Last Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Last name *
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                disabled={loading}
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Phone (optional)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-gray-400 font-medium">+91</span>
                <Phone className="absolute left-12 top-3 h-5 w-5 text-gray-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="9876543210"
                  maxLength={10}
                  className="w-full pl-20 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Gender Pills */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Gender (optional)
              </label>
              <div className="flex gap-2">
                {['Male', 'Female', 'Other'].map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g as 'Male' | 'Female' | 'Other')}
                    disabled={loading}
                    className={`flex-1 py-2 px-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                      gender === g
                        ? 'border-purple-600 bg-purple-50 text-purple-700'
                        : 'border-gray-200 text-gray-600 hover:border-purple-300'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Save Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white font-semibold py-2.5 rounded-xl transition-all duration-200 mt-6"
            >
              {loading ? 'Saving...' : 'Save & Continue'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

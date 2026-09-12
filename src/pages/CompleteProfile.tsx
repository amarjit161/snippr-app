import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Phone, ShieldCheck } from 'lucide-react';
import { V, VA, BG, DISP, BODY } from '@/components/landing/tokens';
import { normalizePhone, syncVerifiedPhoneToProfile } from '@/lib/phone';

const calculateCompletion = (fields: { firstName?: string; lastName?: string; phone?: string; gender?: string; email?: string }): number => {
  const filled = Object.values(fields).filter(Boolean).length;
  return Math.round((filled / 5) * 100);
};

const fieldStyle: React.CSSProperties = {
  padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 14, outline: 'none',
  fontFamily: BODY, boxSizing: 'border-box', width: '100%',
};

const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.4)', marginBottom: 6, display: 'block',
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
  // Populated only when Supabase Auth itself confirms the phone (phone_confirmed_at
  // set) — e.g. the user just came from Mobile OTP login. When set, the phone is
  // shown as a read-only "Verified" row instead of asking the user to enter/verify
  // it again here.
  const [verifiedAuthPhone, setVerifiedAuthPhone] = useState<string | null>(null);

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

        const authVerifiedPhone = user.phone && user.phone_confirmed_at ? normalizePhone(user.phone) : null;
        setVerifiedAuthPhone(authVerifiedPhone);

        // Supabase Auth is the source of truth for a verified phone — sync it into
        // customer_profiles now. This never sends another OTP; it only persists a
        // number Auth has already verified via the Mobile OTP login just completed.
        if (authVerifiedPhone) {
          await syncVerifiedPhoneToProfile(user.id);
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
          setGender(profile.gender || '');
          if (!authVerifiedPhone) {
            // No verified Auth phone (e.g. Google/Email signup) — preserve the
            // existing free-text phone entry behavior exactly as before.
            setPhone(profile.phone?.replace(/\+91/, '') || '');
          }
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

      // If Auth already verified a phone, that verified number always wins — the
      // user never gets a chance to overwrite it with an unverified one here.
      const resolvedPhone = verifiedAuthPhone || (phone ? `+91${phone.replace(/\D/g, '')}` : null);

      const profileData = {
        id: userId,
        first_name: firstName,
        last_name: lastName,
        email: userEmail,
        phone: resolvedPhone,
        gender: gender || null,
        profile_complete_pct: calculateCompletion({ firstName, lastName, email: userEmail, phone: resolvedPhone || '', gender }),
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

  const completion = calculateCompletion({ firstName, lastName, email: userEmail, phone: verifiedAuthPhone || phone, gender });

  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: BODY, position: 'relative', overflow: 'hidden' }}>
      <div aria-hidden="true" style={{ position: 'fixed', top: '10%', right: '5%', width: 400, height: 400, borderRadius: '50%',
        background: `radial-gradient(circle, ${V}12, transparent 70%)`, filter: 'blur(60px)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 460, position: 'relative', zIndex: 10 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{ fontFamily: DISP, fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', marginBottom: 8 }}>
            Complete your profile
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
            Just a few details to get you started
          </p>
        </div>

        {/* Card */}
        <div style={{ borderRadius: 24, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: 28, backdropFilter: 'blur(20px)' }}>
          {/* Progress Bar */}
          <div style={{ marginBottom: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
              <span>Profile completion</span><span>{completion}%</span>
            </div>
            <div style={{ height: 3, borderRadius: 99, background: 'rgba(255,255,255,0.07)' }}>
              <div style={{ width: `${completion}%`, height: '100%', borderRadius: 99, background: `linear-gradient(90deg, ${V}, ${VA})`, transition: 'width 0.4s ease' }} />
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* First Name */}
            <div>
              <label style={labelStyle}>First name *</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
                disabled={loading}
                style={fieldStyle}
              />
            </div>

            {/* Last Name */}
            <div>
              <label style={labelStyle}>Last name *</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                disabled={loading}
                style={fieldStyle}
              />
            </div>

            {/* Phone */}
            <div>
              <label style={labelStyle}>{verifiedAuthPhone ? 'Phone Number' : 'Phone (optional)'}</label>
              {verifiedAuthPhone ? (
                // Already verified via Mobile OTP login — show it, don't ask again.
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                  padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.03)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff', fontSize: 14 }}>
                    <Phone style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.5)' }} />
                    {verifiedAuthPhone}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#34D399', fontSize: 12, fontWeight: 600 }}>
                    <ShieldCheck style={{ width: 13, height: 13 }} /> Verified
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex' }}>
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 14px',
                    borderRadius: '12px 0 0 12px', border: '1px solid rgba(255,255,255,0.1)', borderRight: 'none',
                    background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 600 }}>
                    <Phone style={{ width: 14, height: 14, marginRight: 6 }} />
                    +91
                  </span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="98765 43210"
                    maxLength={10}
                    disabled={loading}
                    style={{ ...fieldStyle, borderRadius: '0 12px 12px 0' }}
                  />
                </div>
              )}
            </div>

            {/* Gender Pills */}
            <div>
              <label style={labelStyle}>Gender (optional)</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {(['Male', 'Female', 'Other'] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    disabled={loading}
                    style={{ padding: '10px 0', borderRadius: 99, fontSize: 13, fontWeight: gender === g ? 700 : 500, cursor: 'pointer',
                      border: `1px solid ${gender === g ? V : 'rgba(255,255,255,0.1)'}`,
                      background: gender === g ? `${V}28` : 'rgba(255,255,255,0.03)',
                      color: gender === g ? '#fff' : 'rgba(255,255,255,0.5)' }}
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
              style={{ width: '100%', padding: '13px 0', borderRadius: 12, background: loading ? `${V}80` : V, color: '#fff',
                fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer', marginTop: 6, fontFamily: BODY }}
            >
              {loading ? 'Saving...' : 'Save & Continue'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

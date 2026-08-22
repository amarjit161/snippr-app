import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Eye, EyeOff, Mail, CheckCircle, ChevronLeft } from 'lucide-react';
import { V, VA, G, BG, DISP, BODY, MONO } from '@/components/landing/tokens';

const calculateCompletion = (fields: { firstName?: string; lastName?: string; email?: string; phone?: string; gender?: string }): number => {
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

export default function CustomerRegister() {
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other' | ''>('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password.trim()) {
      toast.error('First name, last name, email, and password are required');
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      if (phone) {
        const phoneDigits = phone.replace(/\D/g, '');
        const phoneFormatted = `+91${phoneDigits}`;
        const { data: existing } = await supabase
          .from('customer_profiles')
          .select('id')
          .eq('phone', phoneFormatted)
          .maybeSingle();

        if (existing) {
          toast.error('This phone number is already registered');
          setLoading(false);
          return;
        }
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        toast.error(error.message || 'Registration failed');
        setLoading(false);
        return;
      }

      if (!data.user) {
        toast.error('User creation failed');
        setLoading(false);
        return;
      }

      const profileData = {
        id: data.user.id,
        email,
        first_name: firstName,
        last_name: lastName,
        phone: phone ? `+91${phone.replace(/\D/g, '')}` : null,
        gender: gender || null,
        profile_complete_pct: calculateCompletion({ firstName, lastName, email, phone, gender }),
      };

      const { error: profileError } = await supabase
        .from('customer_profiles')
        .upsert([profileData], { onConflict: 'id' });

      if (profileError) {
        toast.error(profileError.message || 'Failed to create profile');
        setLoading(false);
        return;
      }

      toast.success('Account created! Please sign in.');
      navigate('/login');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const completion = calculateCompletion({ firstName, lastName, email, phone, gender });

  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: BODY, position: 'relative', overflow: 'hidden' }}>
      <div aria-hidden="true" style={{ position: 'fixed', top: '10%', right: '5%', width: 400, height: 400, borderRadius: '50%',
        background: `radial-gradient(circle, ${V}12, transparent 70%)`, filter: 'blur(60px)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 460, position: 'relative', zIndex: 10 }}>
        <button onClick={() => navigate('/login')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(255,255,255,0.3)', fontSize: 13, marginBottom: 24, padding: 0, fontFamily: BODY }}>
          <ChevronLeft style={{ width: 14, height: 14 }} /> Back to login
        </button>

        {/* Completion indicator */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: MONO }}>
            <span>Profile completeness</span><span>{completion}%</span>
          </div>
          <div style={{ height: 3, borderRadius: 99, background: 'rgba(255,255,255,0.07)' }}>
            <div style={{ width: `${completion}%`, height: '100%', borderRadius: 99, background: `linear-gradient(90deg, ${V}, ${VA})`, transition: 'width 0.4s ease' }} />
          </div>
        </div>

        <div style={{ borderRadius: 24, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: 28, backdropFilter: 'blur(20px)' }}>
          <h1 style={{ fontFamily: DISP, fontSize: 24, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', marginBottom: 6 }}>
            Create your account
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 13, marginBottom: 22 }}>
            Join 50,000+ customers skipping the wait
          </p>

          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>First Name</label>
                <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="John" disabled={loading} style={fieldStyle} />
              </div>
              <div>
                <label style={labelStyle}>Last Name</label>
                <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Doe" disabled={loading} style={fieldStyle} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'rgba(255,255,255,0.35)' }} />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="john.doe@example.com" disabled={loading}
                  style={{ ...fieldStyle, paddingLeft: 40 }} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Phone Number (optional)</label>
              <div style={{ display: 'flex' }}>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 14px',
                  borderRadius: '12px 0 0 12px', border: '1px solid rgba(255,255,255,0.1)', borderRight: 'none',
                  background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 600 }}>
                  +91
                </span>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="98765 43210" disabled={loading}
                  style={{ ...fieldStyle, borderRadius: '0 12px 12px 0' }} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Gender</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {(['Male', 'Female', 'Other'] as const).map(g => (
                  <button key={g} type="button" onClick={() => setGender(g)} disabled={loading}
                    style={{ padding: '10px 0', borderRadius: 99, fontSize: 13, fontWeight: gender === g ? 700 : 500, cursor: 'pointer',
                      border: `1px solid ${gender === g ? V : 'rgba(255,255,255,0.1)'}`,
                      background: gender === g ? `${V}28` : 'rgba(255,255,255,0.03)',
                      color: gender === g ? '#fff' : 'rgba(255,255,255,0.5)' }}>
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••" disabled={loading} style={{ ...fieldStyle, paddingRight: 38 }} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none',
                      cursor: 'pointer', color: 'rgba(255,255,255,0.35)', padding: 0, display: 'flex' }}>
                    {showPassword ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
                  </button>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Confirm</label>
                <div style={{ position: 'relative' }}>
                  <input type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••" disabled={loading} style={{ ...fieldStyle, paddingRight: 38 }} />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none',
                      cursor: 'pointer', color: 'rgba(255,255,255,0.35)', padding: 0, display: 'flex' }}>
                    {showConfirmPassword ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
                  </button>
                </div>
              </div>
            </div>

            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: '13px 0', borderRadius: 12, background: loading ? `${V}80` : V, color: '#fff',
                fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer', marginTop: 6, fontFamily: BODY }}>
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
            Already part of the community?{' '}
            <Link to="/login" style={{ color: VA, fontWeight: 600, textDecoration: 'none' }}>Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

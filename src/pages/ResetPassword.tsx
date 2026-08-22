import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';
import { V, VA, BG, DISP, BODY } from '@/components/landing/tokens';

export const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const emailFromUrl = searchParams.get('email') || '';

  const [step, setStep] = useState<'otp' | 'password'>('otp');
  const [email, setEmail] = useState(emailFromUrl);
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifiedSession, setVerifiedSession] = useState(false);

  useEffect(() => {
    setEmail(emailFromUrl);
  }, [emailFromUrl]);

  useEffect(() => {
    let active = true;

    const handleRecoveryHash = async () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const type = hashParams.get('type');
      const refreshToken = hashParams.get('refresh_token');

      if (accessToken && type === 'recovery') {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || '',
        });

        if (!active) return;

        if (!error) {
          setVerifiedSession(true);
          setStep('password');
          window.history.replaceState({}, '', '/reset-password');
        }
      }
    };

    void handleRecoveryHash();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      if (event === 'PASSWORD_RECOVERY' && session) {
        setVerifiedSession(true);
        setStep('password');
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleVerifyOTP = async () => {
    if (!email) {
      toast.error('Please enter your email');
      return;
    }

    if (otp.length < 6) {
      toast.error('Please enter the OTP from your email');
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: otp.trim(),
      type: 'recovery',
    });

    if (error) {
      console.error('OTP_VERIFY_ERROR:', error);
      if (error.message.includes('expired') || error.message.includes('invalid')) {
        toast.error('OTP expired or invalid. Please request a new reset link.');
      } else {
        toast.error(error.message);
      }
    } else if (data.session) {
      setVerifiedSession(true);
      setStep('password');
      toast.success('OTP verified! Set your new password.');
    }

    setLoading(false);
  };

  const handleSetPassword = async () => {
    if (password.length < 8) {
      toast.error('Minimum 8 characters');
      return;
    }

    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }

    if (!verifiedSession) {
      toast.error('Please verify your reset code first');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Password updated successfully!');
      await supabase.auth.signOut();
      navigate('/owner-login');
    }

    setLoading(false);
  };

  const pageStyle: React.CSSProperties = { minHeight: '100vh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: BODY, position: 'relative', overflow: 'hidden' };
  const cardStyle: React.CSSProperties = { width: '100%', maxWidth: 400, borderRadius: 24, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: 28, backdropFilter: 'blur(20px)', position: 'relative', zIndex: 10 };
  const fieldStyle: React.CSSProperties = { padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 14, outline: 'none', fontFamily: BODY, boxSizing: 'border-box', width: '100%' };
  const labelStyle: React.CSSProperties = { fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 6, display: 'block' };
  const btnStyle: React.CSSProperties = { width: '100%', padding: '13px 0', borderRadius: 12, background: V, color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer', marginTop: 6, fontFamily: BODY };
  const glowBlob = (
    <div aria-hidden="true" style={{ position: 'fixed', top: '10%', right: '5%', width: 400, height: 400, borderRadius: '50%',
      background: `radial-gradient(circle, ${V}12, transparent 70%)`, filter: 'blur(60px)', pointerEvents: 'none' }} />
  );

  if (step === 'otp') {
    return (
      <div style={pageStyle}>
        {glowBlob}
        <div style={cardStyle}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📧</div>
            <h2 style={{ fontFamily: DISP, fontSize: 20, fontWeight: 700, color: '#fff' }}>Enter reset code</h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 4 }}>Enter the OTP code from your email</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {!emailFromUrl && (
              <div>
                <label style={labelStyle}>Email Address</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" style={fieldStyle} />
              </div>
            )}
            {emailFromUrl && (
              <div style={{ borderRadius: 12, padding: '12px 16px', fontSize: 13, fontWeight: 600, color: VA, background: `${V}14` }}>
                📬 Resetting for: {emailFromUrl}
              </div>
            )}
            <div>
              <label style={labelStyle}>OTP Code from Email</label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="Enter 8-digit OTP"
                maxLength={8}
                style={{ ...fieldStyle, textAlign: 'center', fontSize: 22, fontWeight: 700, letterSpacing: '0.3em' }}
              />
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 8, textAlign: 'center' }}>
                Check your email for the OTP code (valid 1 hour)
              </p>
            </div>
            <button onClick={handleVerifyOTP} disabled={loading || otp.length < 6} style={{ ...btnStyle, opacity: loading || otp.length < 6 ? 0.5 : 1 }}>
              {loading ? 'Verifying…' : 'Verify OTP →'}
            </button>
            <button onClick={() => navigate('/forgot-password')} style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 4, fontFamily: BODY }}>
              ← Request new reset link
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      {glowBlob}
      <div style={cardStyle}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔐</div>
          <h2 style={{ fontFamily: DISP, fontSize: 20, fontWeight: 700, color: '#fff' }}>Set new password</h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 4 }}>Choose a strong password</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>New Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                style={{ ...fieldStyle, paddingRight: 40 }}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', padding: 0, display: 'flex' }}>
                {showPassword ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
              </button>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Confirm Password</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter password" style={fieldStyle} />
          </div>

          {password.length > 0 && (
            <div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    style={{
                      height: 4, flex: 1, borderRadius: 99,
                      background: password.length >= i * 3
                        ? i <= 2 ? '#F87171' : i === 3 ? '#FBBF24' : '#10B981'
                        : 'rgba(255,255,255,0.08)',
                    }}
                  />
                ))}
              </div>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                {password.length < 6
                  ? 'Too short'
                  : password.length < 9
                    ? 'Could be stronger'
                    : password.length < 12
                      ? 'Good password'
                      : 'Strong password ✓'}
              </p>
            </div>
          )}

          <button onClick={handleSetPassword} disabled={loading || password.length < 8 || password !== confirm}
            style={{ ...btnStyle, opacity: loading || password.length < 8 || password !== confirm ? 0.5 : 1 }}>
            {loading ? 'Updating…' : '✅ Update Password'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;


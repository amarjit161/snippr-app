import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Eye, EyeOff, Mail, Lock, Chrome, Scissors, ChevronLeft, Smartphone } from 'lucide-react';
import { V, VA, BG, DISP, BODY, MONO } from '@/components/landing/tokens';
import MobileOtpAuth from '@/components/MobileOtpAuth';

export default function CustomerLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  // Mobile OTP is the third, optional auth method — never shown/active by default.
  const [showMobileAuth, setShowMobileAuth] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error('Please enter email and password');
      return;
    }

    setLoading(true);

    try {
      const { error, data } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error(
          error.message === 'Invalid login credentials'
            ? 'Wrong email or password. Forgot your password?'
            : error.message
        );
        return;
      }

      if (data?.user?.id) {
        const { data: profile } = await supabase
          .from('customer_profiles')
          .select('first_name, phone')
          .eq('id', data.user.id)
          .maybeSingle();

        if (!profile?.first_name) {
          navigate('/complete-profile');
        } else {
          const redirectTo = localStorage.getItem('redirectAfterLogin');
          localStorage.removeItem('redirectAfterLogin');
          navigate(redirectTo && redirectTo.startsWith('/') ? redirectTo : '/salons');
        }
      }
    } catch {
      toast.error('Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      const returnTo = sessionStorage.getItem('returnTo') || '/salons';
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnTo)}`,
        },
      });

      if (error) {
        toast.error(error.message);
      }
    } catch {
      toast.error('Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', fontFamily: BODY, position: 'relative', overflow: 'hidden' }}>
      {/* Background blobs */}
      <div aria-hidden="true" style={{ position: 'absolute', top: '15%', left: '5%', width: 500, height: 500,
        borderRadius: '50%', background: `radial-gradient(circle, ${V}14, transparent 70%)`, filter: 'blur(60px)', pointerEvents: 'none' }} />
      <div aria-hidden="true" style={{ position: 'absolute', top: '55%', right: '5%', width: 380, height: 380,
        borderRadius: '50%', background: `radial-gradient(circle, ${VA}0E, transparent 70%)`, filter: 'blur(60px)', pointerEvents: 'none' }} />

      {/* Left panel */}
      <div className="hidden md:flex" style={{ flex: 1, flexDirection: 'column', justifyContent: 'center', padding: '48px 64px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 48 }}>
          <div style={{ width: 36, height: 36, borderRadius: 12, background: V, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Scissors style={{ width: 18, height: 18, color: '#fff' }} />
          </div>
          <span style={{ fontFamily: DISP, fontWeight: 700, fontSize: 22, color: '#fff' }}>Snippr</span>
        </div>
        <h2 style={{ fontFamily: DISP, fontSize: 40, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 16 }}>
          Skip the wait.<br /><span style={{ color: V }}>Get the chair.</span>
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 16, maxWidth: 340, lineHeight: 1.7 }}>
          Join 50,000+ customers who never wait in a salon queue again.
        </p>
        <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { n: '01', t: 'Find nearby salons with live queues' },
            { n: '02', t: 'Book in seconds, no phone calls needed' },
            { n: '03', t: 'Walk in exactly when your stylist is ready' },
          ].map(s => (
            <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: `${V}20`, border: `1px solid ${V}40`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: VA, fontFamily: MONO }}>{s.n}</div>
              <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14 }}>{s.t}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div style={{ flex: '0 0 auto', width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '32px 28px', position: 'relative', zIndex: 10 }}>
        <button onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
          cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: 13, marginBottom: 32, padding: 0, fontFamily: BODY }}>
          <ChevronLeft style={{ width: 14, height: 14 }} /> Back to website
        </button>

        <div style={{ borderRadius: 24, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          padding: 28, backdropFilter: 'blur(24px)' }}>
          {showMobileAuth ? (
            <MobileOtpAuth onBack={() => setShowMobileAuth(false)} />
          ) : (
          <>
          <h1 style={{ fontFamily: DISP, fontSize: 26, fontWeight: 800, color: '#fff', marginBottom: 6, letterSpacing: '-0.02em' }}>Welcome back.</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 22 }}>Sign in to continue to Snippr</p>

          <button
            onClick={handleGoogle}
            disabled={loading}
            style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)', color: '#fff', fontWeight: 600, fontSize: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer',
              marginBottom: 18, fontFamily: BODY, opacity: loading ? 0.6 : 1 }}>
            <Chrome style={{ width: 16, height: 16 }} /> Continue with Google
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0', color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />or sign in with email
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
          </div>

          <form onSubmit={handleEmailLogin}>
            <div style={{ marginBottom: 10, position: 'relative' }}>
              <Mail style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'rgba(255,255,255,0.35)' }} />
              <input type="email" placeholder="your@email.com" value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={loading}
                style={{ width: '100%', padding: '12px 14px 12px 40px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 14, outline: 'none',
                  fontFamily: BODY, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 6, position: 'relative' }}>
              <Lock style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'rgba(255,255,255,0.35)' }} />
              <input type={showPassword ? 'text' : 'password'} placeholder="Password" value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={loading}
                style={{ width: '100%', padding: '12px 40px 12px 40px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 14, outline: 'none',
                  fontFamily: BODY, boxSizing: 'border-box' }} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} disabled={loading}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none',
                  cursor: 'pointer', color: 'rgba(255,255,255,0.35)', padding: 0, display: 'flex' }}>
                {showPassword ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
              </button>
            </div>
            <div style={{ textAlign: 'right', marginBottom: 14 }}>
              <Link to="/forgot-password" style={{ color: VA, fontSize: 12, textDecoration: 'none' }}>Forgot password?</Link>
            </div>
            <button type="submit" disabled={loading || !email || !password}
              style={{ width: '100%', padding: '13px 0', borderRadius: 12, background: loading ? `${V}80` : V,
                color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer', fontFamily: BODY }}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0 14px', color: 'rgba(255,255,255,0.15)', fontSize: 12 }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />or
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
          </div>

          {/* Third, optional auth method. Clicking this only reveals the phone entry
              screen — no OTP is requested until the user submits a number there. */}
          <button
            onClick={() => setShowMobileAuth(true)}
            style={{ width: '100%', minHeight: 44, padding: '10px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)',
              background: 'transparent', color: 'rgba(255,255,255,0.55)', fontWeight: 600, fontSize: 13,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', fontFamily: BODY }}>
            <Smartphone style={{ width: 15, height: 15 }} /> Continue with Mobile
          </button>

          <p style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
            New to Snippr?{' '}
            <Link to="/register" style={{ color: VA, fontWeight: 600, textDecoration: 'none' }}>Create account</Link>
          </p>
          </>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
          Salon owner?{' '}
          <Link to="/owner-login" style={{ color: VA, textDecoration: 'none' }}>Sign in here →</Link>
        </p>
        <p style={{ textAlign: 'center', marginTop: 10, fontSize: 11, color: 'rgba(255,255,255,0.15)' }}>
          By continuing, you agree to our <span style={{ color: 'rgba(255,255,255,0.35)' }}>Terms of Service</span> and <span style={{ color: 'rgba(255,255,255,0.35)' }}>Privacy Policy</span>
        </p>
      </div>
    </div>
  );
}

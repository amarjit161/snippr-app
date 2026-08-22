import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { V, VA, BG, DISP, BODY } from '@/components/landing/tokens';

const fieldStyle: React.CSSProperties = {
  padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 14, outline: 'none',
  fontFamily: BODY, boxSizing: 'border-box', width: '100%',
};

const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.4)', marginBottom: 6, display: 'block',
};

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast.error('Please enter your email');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password?email=${encodeURIComponent(email)}`,
      });

      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }

      setSent(true);
      navigate(`/reset-password?email=${encodeURIComponent(email)}`);
      toast.success('Check your email for a reset code and the reset link.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: BODY, position: 'relative', overflow: 'hidden' }}>
      <div aria-hidden="true" style={{ position: 'fixed', top: '10%', right: '5%', width: 400, height: 400, borderRadius: '50%',
        background: `radial-gradient(circle, ${V}12, transparent 70%)`, filter: 'blur(60px)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 440, position: 'relative', zIndex: 10 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{ fontFamily: DISP, fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', marginBottom: 8 }}>
            Reset password
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
            We'll send you a reset code and a link to open the reset page
          </p>
        </div>

        <div style={{ borderRadius: 24, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: 28, backdropFilter: 'blur(20px)' }}>
          {!sent ? (
            <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Email Address</label>
                <div style={{ position: 'relative' }}>
                  <Mail style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'rgba(255,255,255,0.35)' }} />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" disabled={loading}
                    style={{ ...fieldStyle, paddingLeft: 40 }} />
                </div>
              </div>

              <button type="submit" disabled={loading}
                style={{ width: '100%', padding: '13px 0', borderRadius: 12, background: loading ? `${V}80` : V, color: '#fff',
                  fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer', marginTop: 6, fontFamily: BODY }}>
                {loading ? 'Sending…' : 'Send reset code'}
              </button>

              <Link to="/login"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: VA, fontWeight: 600, fontSize: 13, textDecoration: 'none', padding: '8px 0' }}>
                <ArrowLeft style={{ width: 14, height: 14 }} />
                Back to login
              </Link>
            </form>
          ) : (
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle style={{ width: 26, height: 26, color: '#10B981' }} />
                </div>
              </div>

              <div>
                <h2 style={{ fontFamily: DISP, fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 8 }}>Check your email</h2>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
                  We sent a reset code and link to <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>{email}</span>
                </p>
              </div>

              <Link to="/login"
                style={{ display: 'block', textAlign: 'center', width: '100%', padding: '13px 0', borderRadius: 12, background: V, color: '#fff',
                  fontWeight: 700, fontSize: 14, textDecoration: 'none', fontFamily: BODY, boxSizing: 'border-box' }}>
                Back to login
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


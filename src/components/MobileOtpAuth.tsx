import { useEffect, useMemo, useRef, useState } from 'react';
import type { ClipboardEvent, KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ChevronLeft, Loader2, ShieldCheck, Smartphone } from 'lucide-react';
import { V, VA, BODY, MONO } from '@/components/landing/tokens';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

interface MobileOtpAuthProps {
  /** Return to the primary Google/Email auth screen. Mobile OTP is opt-in only. */
  onBack: () => void;
}

/**
 * Third, OPTIONAL authentication method (after Google and Email).
 *
 * IMPORTANT — Twilio Verify cost protection:
 * supabase.auth.signInWithOtp({ phone }) is called from exactly TWO places in this
 * file, both inside user click handlers (handleSendOtp, handleResendOtp). It is
 * never called from a useEffect, on mount, or automatically in any way. Resend is
 * gated behind an explicit 60s cooldown + user click. There is no retry logic.
 */
export default function MobileOtpAuth({ onBack }: MobileOtpAuthProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<'entry' | 'verify'>('entry');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [normalizedPhone, setNormalizedPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [resending, setResending] = useState(false);

  const [otpDigits, setOtpDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [otpError, setOtpError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  // Pure UI countdown for the resend button. Does not call Supabase or Twilio.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const otpValue = useMemo(() => otpDigits.join(''), [otpDigits]);

  // Strips everything but digits and tolerates an accidentally-pasted "+91"/"091"
  // prefix so the user can never end up with +91 applied twice.
  const sanitizePhoneInput = (raw: string) => {
    let digitsOnly = raw.replace(/\D/g, '');
    if (digitsOnly.length > 10 && digitsOnly.startsWith('91')) {
      digitsOnly = digitsOnly.slice(digitsOnly.length - 10);
    }
    return digitsOnly.slice(0, 10);
  };

  const isValidIndianMobile = (tenDigits: string) => /^[6-9]\d{9}$/.test(tenDigits);

  const handlePhoneChange = (raw: string) => {
    setPhoneError(null);
    setPhoneDigits(sanitizePhoneInput(raw));
  };

  const routeAfterAuth = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      if (!userId) {
        navigate('/salons');
        return;
      }

      const { data: profile } = await supabase
        .from('customer_profiles')
        .select('first_name')
        .eq('id', userId)
        .maybeSingle();

      if (!profile?.first_name) {
        navigate('/complete-profile');
      } else {
        const redirectTo = localStorage.getItem('redirectAfterLogin');
        localStorage.removeItem('redirectAfterLogin');
        navigate(redirectTo && redirectTo.startsWith('/') ? redirectTo : '/salons');
      }
    } catch {
      navigate('/salons');
    }
  };

  // Explicit, user-initiated only: fires on the "Send OTP" button click.
  const handleSendOtp = async () => {
    if (sending) return;
    setPhoneError(null);

    if (!isValidIndianMobile(phoneDigits)) {
      setPhoneError('Enter a valid 10-digit mobile number.');
      return;
    }

    const phone = `+91${phoneDigits}`;
    setSending(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone });

      if (error) {
        toast.error(error.message || 'Could not send OTP. Please try again.');
        return;
      }

      setNormalizedPhone(phone);
      setOtpDigits(Array(OTP_LENGTH).fill(''));
      setOtpError(null);
      setStep('verify');
      setCooldown(RESEND_COOLDOWN_SECONDS);
      toast.success('OTP sent to your mobile number');
    } catch {
      toast.error('Could not send OTP. Please try again.');
    } finally {
      setSending(false);
    }
  };

  // Explicit, user-initiated only: fires on the "Resend OTP" button click,
  // which is disabled until the 60s cooldown elapses. No automatic retries.
  const handleResendOtp = async () => {
    if (resending || cooldown > 0 || !normalizedPhone) return;

    setResending(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: normalizedPhone });

      if (error) {
        toast.error(error.message || 'Could not resend OTP. Please try again.');
        return;
      }

      setCooldown(RESEND_COOLDOWN_SECONDS);
      toast.success('OTP resent');
    } catch {
      toast.error('Could not resend OTP. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const setDigitAt = (idx: number, value: string) => {
    setOtpDigits((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  };

  const handleOtpChange = (idx: number, value: string) => {
    setOtpError(null);
    const sanitized = value.replace(/\D/g, '');

    if (!sanitized) {
      setDigitAt(idx, '');
      return;
    }

    const chars = sanitized.slice(0, OTP_LENGTH).split('');
    setOtpDigits((prev) => {
      const next = [...prev];
      let cursor = idx;
      for (const char of chars) {
        if (cursor >= OTP_LENGTH) break;
        next[cursor] = char;
        cursor += 1;
      }
      return next;
    });

    const focusIndex = Math.min(idx + chars.length, OTP_LENGTH - 1);
    inputRefs.current[focusIndex]?.focus();
  };

  const handleOtpKeyDown = (idx: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !otpDigits[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
    if (event.key === 'ArrowLeft' && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
    if (event.key === 'ArrowRight' && idx < OTP_LENGTH - 1) {
      inputRefs.current[idx + 1]?.focus();
    }
    if (event.key === 'Enter' && otpValue.length === OTP_LENGTH) {
      handleVerifyOtp();
    }
  };

  const handleOtpPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;

    const next = Array(OTP_LENGTH).fill('');
    pasted.split('').forEach((digit, idx) => {
      next[idx] = digit;
    });
    setOtpDigits(next);
    inputRefs.current[Math.min(pasted.length, OTP_LENGTH) - 1]?.focus();
  };

  // Verification only ever goes through Supabase — never verified locally,
  // never a hardcoded/fake OTP accepted.
  const handleVerifyOtp = async () => {
    if (verifying) return;

    if (otpValue.length !== OTP_LENGTH) {
      setOtpError('Please enter all 6 digits');
      return;
    }

    setVerifying(true);
    setOtpError(null);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: normalizedPhone,
        token: otpValue,
        type: 'sms',
      });

      if (error) {
        setOtpError(error.message || 'Invalid or expired code. Please try again.');
        return;
      }

      toast.success('Phone verified!');
      await routeAfterAuth();
    } catch {
      setOtpError('Verification failed. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const handleChangeNumber = () => {
    setStep('entry');
    setOtpDigits(Array(OTP_LENGTH).fill(''));
    setOtpError(null);
    setCooldown(0);
  };

  const inputBaseStyle: React.CSSProperties = {
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.05)',
    color: '#fff',
    fontSize: 14,
    outline: 'none',
    fontFamily: BODY,
    boxSizing: 'border-box',
  };

  return (
    <div>
      <button
        type="button"
        onClick={step === 'entry' ? onBack : handleChangeNumber}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
          cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 18, padding: 0,
          fontFamily: BODY, minHeight: 44,
        }}
      >
        <ChevronLeft style={{ width: 14, height: 14 }} /> {step === 'entry' ? 'Back to sign in' : 'Change mobile number'}
      </button>

      {step === 'entry' ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: `${V}26`, border: `1px solid ${V}40`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Smartphone style={{ width: 16, height: 16, color: VA }} />
            </div>
            <h1 style={{ fontSize: 19, fontWeight: 700, color: '#fff', margin: 0, letterSpacing: '-0.01em' }}>
              Verify your mobile number
            </h1>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 20 }}>
            We'll text you a 6-digit code. Standard SMS rates may apply.
          </p>

          <label htmlFor="mobile-otp-phone" style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>
            Mobile number
          </label>
          <div style={{ display: 'flex', gap: 8, marginBottom: phoneError ? 8 : 20 }}>
            <div style={{ ...inputBaseStyle, display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 56, height: 44, fontWeight: 600, color: 'rgba(255,255,255,0.7)', flexShrink: 0 }}>
              +91
            </div>
            <input
              id="mobile-otp-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="10-digit mobile number"
              aria-label="10-digit mobile number"
              value={phoneDigits}
              onChange={(e) => handlePhoneChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
              disabled={sending}
              style={{ ...inputBaseStyle, flex: 1, height: 44, padding: '0 14px' }}
            />
          </div>

          {phoneError && (
            <p role="alert" style={{ color: '#f87171', fontSize: 12, marginTop: -12, marginBottom: 16 }}>
              {phoneError}
            </p>
          )}

          <button
            type="button"
            onClick={handleSendOtp}
            disabled={sending || phoneDigits.length !== 10}
            style={{
              width: '100%', height: 44, borderRadius: 12, background: sending ? `${V}80` : V,
              color: '#fff', fontWeight: 700, fontSize: 14, border: 'none',
              cursor: sending || phoneDigits.length !== 10 ? 'not-allowed' : 'pointer',
              fontFamily: BODY, opacity: phoneDigits.length !== 10 ? 0.6 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {sending ? <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" /> : null}
            {sending ? 'Sending…' : 'Send OTP'}
          </button>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: `${V}26`, border: `1px solid ${V}40`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ShieldCheck style={{ width: 16, height: 16, color: VA }} />
            </div>
            <h1 style={{ fontSize: 19, fontWeight: 700, color: '#fff', margin: 0, letterSpacing: '-0.01em' }}>
              Enter verification code
            </h1>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 20 }}>
            We sent a 6-digit code to <span style={{ color: 'rgba(255,255,255,0.7)' }}>{normalizedPhone}</span>
          </p>

          <div role="group" aria-label="6-digit verification code" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: otpError ? 8 : 20 }}>
            {otpDigits.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => { inputRefs.current[idx] = el; }}
                value={digit}
                onChange={(e) => handleOtpChange(idx, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                onPaste={handleOtpPaste}
                inputMode="numeric"
                maxLength={1}
                aria-label={`Digit ${idx + 1} of 6`}
                disabled={verifying}
                style={{
                  ...inputBaseStyle, width: 44, height: 48, textAlign: 'center', fontSize: 18, fontFamily: MONO, padding: 0,
                }}
              />
            ))}
          </div>

          {otpError && (
            <p role="alert" style={{ color: '#f87171', fontSize: 12, marginTop: -12, marginBottom: 16 }}>
              {otpError}
            </p>
          )}

          <button
            type="button"
            onClick={handleVerifyOtp}
            disabled={verifying || otpValue.length !== OTP_LENGTH}
            style={{
              width: '100%', height: 44, borderRadius: 12, background: verifying ? `${V}80` : V,
              color: '#fff', fontWeight: 700, fontSize: 14, border: 'none',
              cursor: verifying || otpValue.length !== OTP_LENGTH ? 'not-allowed' : 'pointer',
              fontFamily: BODY, opacity: otpValue.length !== OTP_LENGTH ? 0.6 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16,
            }}
          >
            {verifying ? <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" /> : null}
            {verifying ? 'Verifying…' : 'Verify'}
          </button>

          <div style={{ textAlign: 'center' }}>
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={cooldown > 0 || resending}
              style={{
                background: 'none', border: 'none', fontFamily: BODY, fontSize: 13, minHeight: 44,
                color: cooldown > 0 || resending ? 'rgba(255,255,255,0.3)' : VA,
                cursor: cooldown > 0 || resending ? 'not-allowed' : 'pointer',
              }}
            >
              {resending ? 'Resending…' : cooldown > 0 ? `Resend OTP in ${cooldown}s` : 'Resend OTP'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

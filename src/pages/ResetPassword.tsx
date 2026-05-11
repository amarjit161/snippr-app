import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';

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

  const cardStyle = 'min-h-screen flex items-center justify-center bg-gray-50 px-4';
  const innerStyle = 'bg-white rounded-2xl p-8 max-w-sm w-full shadow-sm border border-gray-100';
  const inputStyle = 'w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all';
  const btnStyle = 'w-full bg-purple-600 text-white py-3.5 rounded-xl font-semibold text-sm hover:bg-purple-700 transition-all disabled:opacity-50 shadow-lg shadow-purple-200 mt-2';

  if (step === 'otp') {
    return (
      <div className={cardStyle}>
        <div className={innerStyle}>
          <div className="text-center mb-6">
            <div className="text-4xl mb-3">📧</div>
            <h2 className="text-xl font-bold text-gray-900">Enter reset code</h2>
            <p className="text-gray-500 text-sm mt-1">Enter the OTP code from your email</p>
          </div>
          <div className="space-y-4">
            {!emailFromUrl && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className={inputStyle}
                />
              </div>
            )}
            {emailFromUrl && (
              <div className="bg-purple-50 rounded-xl px-4 py-3 text-sm text-purple-800 font-medium">
                📬 Resetting for: {emailFromUrl}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                OTP Code from Email
              </label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="Enter 8-digit OTP"
                className={`${inputStyle} text-center text-2xl font-bold tracking-widest`}
                maxLength={8}
              />
              <p className="text-xs text-gray-400 mt-1.5 text-center">
                Check your email for the OTP code (valid 1 hour)
              </p>
            </div>
            <button
              onClick={handleVerifyOTP}
              disabled={loading || otp.length < 6}
              className={btnStyle}
            >
              {loading ? 'Verifying...' : 'Verify OTP →'}
            </button>
            <button
              onClick={() => navigate('/forgot-password')}
              className="w-full text-sm text-gray-500 hover:text-purple-600 text-center mt-2"
            >
              ← Request new reset link
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cardStyle}>
      <div className={innerStyle}>
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">🔐</div>
          <h2 className="text-xl font-bold text-gray-900">Set new password</h2>
          <p className="text-gray-500 text-sm mt-1">Choose a strong password</p>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className={`${inputStyle} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter password"
              className={inputStyle}
            />
          </div>

          {password.length > 0 && (
            <div>
              <div className="flex gap-1 mb-1">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full ${
                      password.length >= i * 3
                        ? i <= 2
                          ? 'bg-red-400'
                          : i === 3
                            ? 'bg-yellow-400'
                            : 'bg-green-500'
                        : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs text-gray-400">
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

          <button
            onClick={handleSetPassword}
            disabled={loading || password.length < 8 || password !== confirm}
            className={btnStyle}
          >
            {loading ? 'Updating...' : '✅ Update Password'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;

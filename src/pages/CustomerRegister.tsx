import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Scissors, Eye, EyeOff } from 'lucide-react';

type Step = 'form' | 'phone_otp' | 'gender' | 'success';
type Gender = 'Male' | 'Female' | 'Other' | null;

export const CustomerRegister = () => {
  const navigate = useNavigate();
  
  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // OTP state
  const [otp, setOtp] = useState('');
  const [otpCountdown, setOtpCountdown] = useState(0);
  
  // Profile state
  const [gender, setGender] = useState<Gender>(null);
  
  // UI state
  const [step, setStep] = useState<Step>('form');
  const [loading, setLoading] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  // ── COUNTDOWN TIMER ────────────────────────────
  const startCountdown = (seconds = 60) => {
    setOtpCountdown(seconds);
    const interval = setInterval(() => {
      setOtpCountdown(prev => {
        if (prev <= 1) { 
          clearInterval(interval); 
          return 0; 
        }
        return prev - 1;
      });
    }, 1000);
  };

  // ── STEP 1: REGISTER FORM ──────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password.trim() || !phone.trim()) {
      toast.error('Please fill all fields');
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length !== 10) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);

    try {
      const phoneFormatted = `+91${phoneDigits}`;

      // 1. Sign up with Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        phone: phoneFormatted,
      });

      if (error) throw error;

      if (!data.user) throw new Error('User creation failed');

      // 2. Send phone OTP via Supabase (will use configured SMS provider - Twilio)
      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone: phoneFormatted,
      });

      if (otpError) {
        console.warn('OTP send failed:', otpError);
        toast.warning('Account created. Please enter OTP sent to your phone.');
      } else {
        toast.success('OTP sent to your phone!');
      }

      setPendingUserId(data.user.id);
      setStep('phone_otp');
      startCountdown(60);
    } catch (err: any) {
      toast.error(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  // ── STEP 2: VERIFY PHONE OTP ───────────────────
  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      toast.error('Enter 6-digit OTP');
      return;
    }

    if (!pendingUserId) {
      toast.error('Session expired. Please try again.');
      return;
    }

    setLoading(true);

    try {
      const phoneDigits = phone.replace(/\D/g, '');
      const phoneFormatted = `+91${phoneDigits}`;

      console.log('🔐 Starting OTP verification:', { phone: phoneFormatted, otp: otp.substring(0, 3) + '***' });

      // Set a timeout to prevent infinite hanging
      const verifyPromise = supabase.auth.verifyOtp({
        phone: phoneFormatted,
        token: otp,
        type: 'sms',
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Verification timeout - server not responding. Check console for details.')), 15000)
      );

      const { error } = await Promise.race([verifyPromise, timeoutPromise]) as any;

      if (error) {
        console.error('❌ OTP verification error:', error);
        throw error;
      }

      console.log('✅ OTP verification successful');
      toast.success('Phone verified!');
      setStep('gender');
    } catch (err: any) {
      console.error('🚨 Verification error caught:', err);
      toast.error(err.message || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  // ── STEP 3: SELECT GENDER ─────────────────────
  const handleCompleteProfile = async () => {
    if (!gender) {
      toast.error('Please select your gender');
      return;
    }

    if (!pendingUserId) {
      toast.error('Session expired. Please try again.');
      return;
    }

    setLoading(true);

    try {
      const phoneDigits = phone.replace(/\D/g, '');
      const phoneFormatted = `+91${phoneDigits}`;

      // Create customer profile
      const { error } = await supabase
        .from('customer_profiles')
        .upsert({
          id: pendingUserId,
          email,
          first_name: firstName,
          last_name: lastName,
          phone: phoneFormatted,
          gender,
        }, { onConflict: 'id' });

      if (error) throw error;

      toast.success('Profile complete!');
      setStep('success');

      // Redirect after 1.5 seconds
      setTimeout(() => {
        navigate('/salons');
      }, 1500);
    } catch (err: any) {
      toast.error(err.message || 'Profile creation failed');
    } finally {
      setLoading(false);
    }
  };

  // ── RESEND OTP ────────────────────────────────
  const handleResendOTP = async () => {
    setLoading(true);

    try {
      const phoneDigits = phone.replace(/\D/g, '');
      const phoneFormatted = `+91${phoneDigits}`;

      const { error } = await supabase.auth.signInWithOtp({
        phone: phoneFormatted,
      });

      if (error) throw error;

      toast.success('OTP resent!');
      startCountdown(60);
    } catch (err: any) {
      toast.error(err.message || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  // ════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50 
                    flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        
        {/* HEADER */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 
                          bg-purple-600 rounded-2xl shadow-lg shadow-purple-200 mb-4">
            <Scissors className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Join Snippr</h1>
          <p className="text-gray-500 text-sm mt-1">
            Create account to start booking at your favorite salons
          </p>
        </div>

        {/* CARD */}
        <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100 space-y-4">
          
          {/* ── STEP 1: REGISTRATION FORM ── */}
          {step === 'form' && (
            <form onSubmit={handleRegister} className="space-y-4">
              {/* Name Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    placeholder="John"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm
                               focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    placeholder="Doe"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm
                               focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm
                             focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Phone Number
                </label>
                <div className="flex gap-2">
                  <div className="flex items-center px-3 py-3 bg-gray-50 border border-gray-200 
                                  rounded-xl text-sm font-medium text-gray-700 flex-shrink-0">
                    🇮🇳 +91
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="9876543210"
                    maxLength={10}
                    className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm
                               focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm
                               focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm
                               focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-purple-600 text-white py-3.5 rounded-xl font-semibold
                           text-sm hover:bg-purple-700 transition-all disabled:opacity-50
                           shadow-lg shadow-purple-200 active:scale-[0.98]"
              >
                {loading ? 'Creating account...' : 'Create Account'}
              </button>

              {/* Sign In Link */}
              <p className="text-center text-sm text-gray-500">
                Already have an account?{' '}
                <Link to="/login" className="text-purple-600 font-medium hover:underline">
                  Sign in
                </Link>
              </p>
            </form>
          )}

          {/* ── STEP 2: PHONE OTP VERIFICATION ── */}
          {step === 'phone_otp' && (
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">
                  OTP sent to
                </p>
                <p className="font-semibold text-gray-900">
                  +91 {phone}
                </p>
                <button
                  type="button"
                  onClick={() => setStep('form')}
                  className="text-xs text-purple-600 hover:underline mt-2"
                >
                  Change number
                </button>
              </div>

              {/* 6-box OTP input */}
              <div className="flex gap-2 justify-center">
                {Array.from({ length: 6 }).map((_, i) => (
                  <input
                    key={i}
                    type="text"
                    maxLength={1}
                    inputMode="numeric"
                    value={otp[i] || ''}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '');
                      const newOtp = otp.split('');
                      newOtp[i] = val;
                      setOtp(newOtp.join(''));
                      
                      // Auto-focus next input
                      if (val && i < 5) {
                        const nextInput = e.currentTarget.parentElement?.children[i + 1] as HTMLInputElement;
                        if (nextInput) nextInput.focus();
                      }
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Backspace' && !otp[i] && i > 0) {
                        const prevInput = e.currentTarget.parentElement?.children[i - 1] as HTMLInputElement;
                        if (prevInput) prevInput.focus();
                      }
                    }}
                    className="w-11 h-12 text-center text-lg font-bold border-2 border-gray-200
                               rounded-xl focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 transition-all"
                  />
                ))}
              </div>

              {/* Verify Button */}
              <button
                onClick={handleVerifyOTP}
                disabled={loading || otp.length !== 6}
                className="w-full bg-purple-600 text-white py-3.5 rounded-xl font-semibold
                           text-sm hover:bg-purple-700 transition-all disabled:opacity-50
                           shadow-lg shadow-purple-200 active:scale-[0.98]"
              >
                {loading ? 'Verifying...' : 'Verify OTP'}
              </button>

              {/* Resend OTP */}
              <div className="text-center">
                {otpCountdown > 0 ? (
                  <p className="text-sm text-gray-400">
                    Resend OTP in <span className="font-semibold">{otpCountdown}s</span>
                  </p>
                ) : (
                  <button
                    onClick={handleResendOTP}
                    disabled={loading}
                    className="text-sm text-purple-600 font-medium hover:underline disabled:opacity-50"
                  >
                    Didn't receive? Resend OTP
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── STEP 3: SELECT GENDER ── */}
          {step === 'gender' && (
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-sm text-gray-600">
                  One more step to complete your profile
                </p>
                <p className="text-lg font-semibold text-gray-900 mt-1">
                  What's your gender?
                </p>
              </div>

              <div className="space-y-3">
                {(['Male', 'Female', 'Other'] as const).map(g => (
                  <button
                    key={g}
                    onClick={() => setGender(g)}
                    className={`w-full py-3 px-4 rounded-xl border-2 font-medium transition-all
                      ${gender === g 
                        ? 'bg-purple-600 text-white border-purple-600 shadow-lg shadow-purple-200' 
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-300'}`}
                  >
                    {g}
                  </button>
                ))}
              </div>

              <button
                onClick={handleCompleteProfile}
                disabled={!gender || loading}
                className="w-full bg-purple-600 text-white py-3.5 rounded-xl font-semibold
                           text-sm hover:bg-purple-700 transition-all disabled:opacity-50
                           shadow-lg shadow-purple-200 active:scale-[0.98]"
              >
                {loading ? 'Completing...' : 'Complete Registration'}
              </button>
            </div>
          )}

          {/* ── SUCCESS ── */}
          {step === 'success' && (
            <div className="text-center py-8">
              <div className="text-5xl mb-4">✨</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Welcome to Snippr, {firstName}!
              </h2>
              <p className="text-sm text-gray-500">
                Redirecting to salons...
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'form' && (
          <div className="mt-6 text-center text-xs text-gray-400">
            By signing up, you agree to our Terms of Service
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerRegister;

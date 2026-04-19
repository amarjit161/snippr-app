import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { sendPhoneOTP, verifyPhoneOTP } from '@/services/phoneAuth';
import { toast } from 'sonner';
import { Scissors, Eye, EyeOff, CheckCircle2 } from 'lucide-react';

type Gender = 'Male' | 'Female' | 'Other' | null;
type Step = 'form' | 'verify_otp' | 'success';

export const CustomerRegister = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [step, setStep] = useState<Step>('form');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<Gender>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // OTP verification state
  const [emailOtp, setEmailOtp] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [pendingAuthData, setPendingAuthData] = useState<any>(null);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password.trim()) {
      toast.error('Please fill in all required fields');
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

    if (phone && phone.replace(/\D/g, '').length !== 10) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);

    try {
      // 1. Sign up with email first
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/salons`,
        },
      });

      if (error) throw error;

      // 2. Send email OTP via Supabase
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
        },
      });

      if (otpError) throw otpError;

      // 3. Send phone OTP via phone.email (if provided)
      if (phone) {
        const result = await sendPhoneOTP(phone);
        if (!result.success) {
          throw new Error(result.error || 'Failed to send phone OTP');
        }
      }

      // Store auth data for later use
      setPendingAuthData(data.user);

      // Start countdown
      setOtpCountdown(60);
      const interval = setInterval(() => {
        setOtpCountdown(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      toast.success('✓ OTP sent to your email and phone!');
      setStep('verify_otp');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!emailOtp || emailOtp.length !== 6) {
      toast.error('Enter 6-digit email OTP');
      return;
    }

    if (phone && (!phoneOtp || phoneOtp.length !== 6)) {
      toast.error('Enter 6-digit phone OTP');
      return;
    }

    setLoading(true);

    try {
      // Verify email OTP via Supabase
      const { data: emailData, error: emailError } = await supabase.auth.verifyOtp({
        email,
        token: emailOtp,
        type: 'email',
      });

      if (emailError) throw emailError;

      setEmailVerified(true);
      toast.success('✓ Email verified!');

      // Verify phone OTP if phone provided
      if (phone) {
        const result = await verifyPhoneOTP(phone, phoneOtp);
        if (!result.success) {
          throw new Error(result.error || 'Invalid phone OTP');
        }
        setPhoneVerified(true);
        toast.success('✓ Phone verified!');
      } else {
        setPhoneVerified(true);
      }

      // Wait a moment then create profile
      setTimeout(() => {
        handleCreateProfile(emailData);
      }, 500);
    } catch (err: any) {
      toast.error(err.message || 'OTP verification failed');
      setLoading(false);
    }
  };

  const handleCreateProfile = async (authData: any) => {
    try {
      if (!authData?.user?.id) {
        throw new Error('No user created');
      }

      const formattedPhone = phone ? `+91${phone.replace(/\D/g,'').slice(-10)}` : null;

      // Check duplicate phone if provided
      if (formattedPhone) {
        const { data: existing } = await supabase
          .from('customer_profiles')
          .select('id')
          .eq('phone', formattedPhone)
          .maybeSingle();

        if (existing) {
          toast.error('This phone number is already registered');
          setLoading(false);
          return;
        }
      }

      // Save profile to customer_profiles
      await supabase.from('customer_profiles').upsert({
        id: authData.user.id,
        first_name: firstName,
        last_name: lastName,
        phone: formattedPhone,
        gender: gender || undefined,
        email,
      });

      setStep('success');
      setTimeout(() => {
        navigate('/profile-completion');
      }, 3000);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create account');
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setLoading(true);
    try {
      // Resend email OTP
      await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
        },
      });

      // Resend phone OTP
      if (phone) {
        const result = await sendPhoneOTP(phone);
        if (!result.success) throw new Error(result.error);
      }

      setOtpCountdown(60);
      const interval = setInterval(() => {
        setOtpCountdown(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      toast.success('OTP resent to your email and phone!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  // ── STEP 1: REGISTRATION FORM
  if (step === 'form') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50 
                      flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 
                            bg-purple-600 rounded-2xl shadow-lg shadow-purple-200 mb-4">
              <Scissors className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Join Snippr</h1>
            <p className="text-gray-500 text-sm mt-1">
              Create an account to book salons and track queues.
            </p>
          </div>

          {/* Card */}
          <div className="bg-white rounded-3xl shadow-xl shadow-gray-100 p-8 border border-gray-100">
            
            <form onSubmit={handleSendOTP} className="space-y-4">
              
              {/* Names */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    placeholder="First name"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm 
                               focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent
                               transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    placeholder="Last name"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm 
                               focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent
                               transition-all"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email address *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm 
                             focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent
                             transition-all"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Phone Number <span className="text-gray-400">(Optional)</span>
                </label>
                <div className="flex gap-2">
                  <div className="flex items-center px-3 py-3 bg-gray-50 border border-gray-200 
                                  rounded-xl text-sm font-medium text-gray-700 flex-shrink-0">
                    🇮🇳 +91
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value.replace(/\D/g,'').slice(0,10))}
                    placeholder="10-digit number"
                    className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm 
                               focus:outline-none focus:ring-2 focus:ring-purple-500 
                               focus:border-transparent transition-all"
                    maxLength={10}
                  />
                </div>
              </div>

              {/* Gender */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Gender <span className="text-gray-400">(Optional)</span>
                </label>
                <div className="flex gap-2">
                  {(['Male', 'Female', 'Other'] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(g === gender ? null : g)}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        gender === g
                          ? 'bg-purple-600 text-white shadow-lg shadow-purple-200'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Password *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm 
                               focus:outline-none focus:ring-2 focus:ring-purple-500 
                               focus:border-transparent transition-all pr-12"
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
                  Confirm Password *
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm 
                               focus:outline-none focus:ring-2 focus:ring-purple-500 
                               focus:border-transparent transition-all pr-12"
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

              {/* Create Account Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-purple-600 text-white py-3.5 rounded-xl font-semibold 
                           text-sm hover:bg-purple-700 transition-all disabled:opacity-50
                           shadow-lg shadow-purple-200 active:scale-[0.98] mt-6"
              >
                {loading ? 'Sending OTP...' : 'Continue & Verify'}
              </button>

              {/* Sign In Link */}
              <p className="text-center text-sm text-gray-500 mt-4">
                Already have an account?{' '}
                <Link to="/login" className="text-purple-600 font-semibold hover:underline">
                  Sign in
                </Link>
              </p>

              <p className="text-center text-xs text-gray-400 mt-3">
                By creating an account, you agree to our{' '}
                <a href="/terms" className="underline">Terms of Service</a> and{' '}
                <a href="/privacy" className="underline">Privacy Policy</a>.
              </p>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ── STEP 2: OTP VERIFICATION
  if (step === 'verify_otp') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50 
                      flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 
                            bg-purple-600 rounded-2xl shadow-lg shadow-purple-200 mb-4">
              <Scissors className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Verify Your Identity</h1>
            <p className="text-gray-500 text-sm mt-1">
              Enter OTP codes sent to your email and phone.
            </p>
          </div>

          {/* Card */}
          <div className="bg-white rounded-3xl shadow-xl shadow-gray-100 p-8 border border-gray-100">
            
            <form onSubmit={handleVerifyOTP} className="space-y-6">
              
              {/* Email OTP */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-gray-900">
                    📧 Email OTP
                  </label>
                  {emailVerified && (
                    <span className="text-xs font-medium text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Verified
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mb-2">OTP sent to {email}</p>
                <div className="flex gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <input
                      key={`email-${i}`}
                      type="text"
                      maxLength={1}
                      value={emailOtp[i] || ''}
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g,'');
                        const newOtp = emailOtp.split('');
                        newOtp[i] = val;
                        setEmailOtp(newOtp.join(''));
                        if (val && e.target.nextElementSibling) {
                          (e.target.nextElementSibling as HTMLInputElement).focus();
                        }
                      }}
                      disabled={emailVerified}
                      className="w-11 h-12 text-center text-lg font-bold border-2 border-gray-200 
                                 rounded-xl focus:outline-none focus:border-purple-500 transition-all
                                 disabled:bg-green-50 disabled:border-green-200"
                    />
                  ))}
                </div>
              </div>

              {/* Phone OTP (if phone provided) */}
              {phone && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-semibold text-gray-900">
                      📱 Phone OTP
                    </label>
                    {phoneVerified && (
                      <span className="text-xs font-medium text-green-600 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Verified
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mb-2">OTP sent to +91 {phone}</p>
                  <div className="flex gap-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <input
                        key={`phone-${i}`}
                        type="text"
                        maxLength={1}
                        value={phoneOtp[i] || ''}
                        onChange={e => {
                          const val = e.target.value.replace(/\D/g,'');
                          const newOtp = phoneOtp.split('');
                          newOtp[i] = val;
                          setPhoneOtp(newOtp.join(''));
                          if (val && e.target.nextElementSibling) {
                            (e.target.nextElementSibling as HTMLInputElement).focus();
                          }
                        }}
                        disabled={phoneVerified}
                        className="w-11 h-12 text-center text-lg font-bold border-2 border-gray-200 
                                   rounded-xl focus:outline-none focus:border-purple-500 transition-all
                                   disabled:bg-green-50 disabled:border-green-200"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Verify Button */}
              <button
                type="submit"
                disabled={loading || !emailOtp || (phone && !phoneOtp)}
                className="w-full bg-purple-600 text-white py-3.5 rounded-xl font-semibold 
                           text-sm hover:bg-purple-700 transition-all disabled:opacity-50
                           shadow-lg shadow-purple-200 active:scale-[0.98]"
              >
                {loading ? 'Verifying...' : 'Verify Both & Create Account'}
              </button>

              {/* Resend */}
              <div className="text-center">
                {otpCountdown > 0 ? (
                  <p className="text-sm text-gray-400">Resend OTP in {otpCountdown}s</p>
                ) : (
                  <button 
                    type="button"
                    onClick={handleResendOTP}
                    className="text-sm text-purple-600 font-medium hover:underline"
                  >
                    Resend OTP
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ── STEP 3: SUCCESS
  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50 
                      flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          
          <div className="inline-flex items-center justify-center w-20 h-20 
                          bg-green-100 rounded-full mb-6">
            <CheckCircle2 className="w-12 h-12 text-green-600" />
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-2">Account Created! 🎉</h1>
          <p className="text-gray-600 text-lg mb-6">
            Welcome, <span className="font-semibold">{firstName} {lastName}</span>!
          </p>

          <div className="bg-white rounded-2xl p-6 mb-6 border border-gray-100 shadow-sm">
            <div className="space-y-3 text-left">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-900">Email Verified</p>
                  <p className="text-sm text-gray-500">{email}</p>
                </div>
              </div>
              {phone && (
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900">Phone Verified</p>
                    <p className="text-sm text-gray-500">+91 {phone}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <p className="text-sm text-gray-600 mb-6">
            Redirecting to login in a moment...
          </p>

          <Link 
            to="/login"
            className="inline-block bg-purple-600 text-white px-8 py-3 rounded-xl font-semibold 
                       hover:bg-purple-700 transition-all shadow-lg shadow-purple-200"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return null;
};

export default CustomerRegister;

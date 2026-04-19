/**
 * TEMPLATE - CustomerRegister.tsx (Twilio Version)
 * 
 * Features:
 * - Email + Password registration
 * - Phone OTP verification (via Supabase + Twilio)
 * - Profile completion (gender selection)
 * - Clean, simple flow
 * 
 * This will replace the current version once Twilio credentials are provided
 */

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Scissors, Eye, EyeOff } from 'lucide-react';

type Step = 'form' | 'phone_otp' | 'gender' | 'success';

export const CustomerRegister = () => {
  const navigate = useNavigate();
  
  // Registration form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Phone OTP
  const [otp, setOtp] = useState('');
  const [otpCountdown, setOtpCountdown] = useState(0);
  
  // Gender
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other' | null>(null);
  
  // UI state
  const [step, setStep] = useState<Step>('form');
  const [loading, setLoading] = useState(false);

  // ── STEP 1: EMAIL & PASSWORD ────────────────────────────
  const handleRegisterForm = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!email.trim() || !password.trim() || !phone.trim()) {
      toast.error('Fill all fields');
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be 6+ characters');
      return;
    }
    if (phone.replace(/\D/g, '').length !== 10) {
      toast.error('Invalid phone number');
      return;
    }

    setLoading(true);

    try {
      // 1. Sign up with Supabase
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        phone: `+91${phone.replace(/\D/g, '')}`,
      });

      if (error) throw error;

      toast.success('Account created! Verify your phone.');
      setStep('phone_otp');
      startCountdown(60);
    } catch (err: any) {
      toast.error(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  // ── STEP 2: PHONE OTP ────────────────────────────────────
  const startCountdown = (seconds = 60) => {
    setOtpCountdown(seconds);
    const interval = setInterval(() => {
      setOtpCountdown(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleVerifyPhone = async () => {
    if (otp.length !== 6) {
      toast.error('Enter 6-digit OTP');
      return;
    }

    setLoading(true);

    try {
      const phoneFormatted = `+91${phone.replace(/\D/g, '')}`;
      
      const { error } = await supabase.auth.verifyOtp({
        phone: phoneFormatted,
        token: otp,
        type: 'sms',
      });

      if (error) throw error;

      toast.success('Phone verified!');
      setStep('gender');
    } catch (err: any) {
      toast.error(err.message || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  // ── STEP 3: COMPLETE PROFILE ────────────────────────────
  const handleCompleteProfile = async () => {
    if (!gender) {
      toast.error('Select your gender');
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const phoneFormatted = `+91${phone.replace(/\D/g, '')}`;

      // Create or update profile
      const { error } = await supabase
        .from('customer_profiles')
        .upsert({
          id: user.id,
          email,
          phone: phoneFormatted,
          gender,
          first_name: email.split('@')[0], // Use email prefix as default
          last_name: '',
        }, { onConflict: 'id' });

      if (error) throw error;

      toast.success('Profile complete!');
      navigate('/salons');
    } catch (err: any) {
      toast.error(err.message || 'Profile creation failed');
    } finally {
      setLoading(false);
    }
  };

  // ════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50 
                    flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        
        {/* HEADER */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 
                          bg-purple-600 rounded-2xl shadow-lg shadow-purple-200 mb-4">
            <Scissors className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Join Snippr</h1>
          <p className="text-gray-500 text-sm mt-1">
            Create account to start managing salon queues
          </p>
        </div>

        {/* CARD */}
        <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
          
          {/* STEP 1: REGISTER FORM */}
          {step === 'form' && (
            <form onSubmit={handleRegisterForm} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm
                             focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm
                               focus:outline-none focus:ring-2 focus:ring-purple-500 pr-10"
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
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm
                               focus:outline-none focus:ring-2 focus:ring-purple-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
                <div className="flex gap-2">
                  <div className="flex items-center px-3 bg-gray-50 border border-gray-200 
                                  rounded-xl text-sm font-medium text-gray-700 flex-shrink-0">
                    🇮🇳 +91
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="10-digit"
                    maxLength={10}
                    className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm
                               focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-purple-600 text-white py-3.5 rounded-xl font-semibold
                           text-sm hover:bg-purple-700 disabled:opacity-50 shadow-lg shadow-purple-200"
              >
                {loading ? 'Creating...' : 'Create Account'}
              </button>

              <p className="text-center text-sm text-gray-500">
                Already have an account?{' '}
                <Link to="/login" className="text-purple-600 font-medium">
                  Sign in
                </Link>
              </p>
            </form>
          )}

          {/* STEP 2: PHONE OTP */}
          {step === 'phone_otp' && (
            <div className="space-y-4">
              <p className="text-center text-sm text-gray-500 mb-4">
                OTP sent to <strong>+91 {phone}</strong>
              </p>

              <div className="flex gap-2 justify-center">
                {Array.from({ length: 6 }).map((_, i) => (
                  <input
                    key={i}
                    type="text"
                    maxLength={1}
                    value={otp[i] || ''}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '');
                      const newOtp = otp.split('');
                      newOtp[i] = val;
                      setOtp(newOtp.join(''));
                    }}
                    className="w-11 h-12 text-center text-lg font-bold border-2 border-gray-200
                               rounded-xl focus:outline-none focus:border-purple-500"
                  />
                ))}
              </div>

              <button
                onClick={handleVerifyPhone}
                disabled={loading || otp.length !== 6}
                className="w-full bg-purple-600 text-white py-3.5 rounded-xl font-semibold
                           text-sm hover:bg-purple-700 disabled:opacity-50 shadow-lg shadow-purple-200"
              >
                {loading ? 'Verifying...' : 'Verify OTP'}
              </button>

              {otpCountdown > 0 ? (
                <p className="text-center text-sm text-gray-400">Resend in {otpCountdown}s</p>
              ) : (
                <button onClick={() => startCountdown(60)} 
                        className="w-full text-sm text-purple-600 font-medium">
                  Resend OTP
                </button>
              )}
            </div>
          )}

          {/* STEP 3: GENDER SELECTION */}
          {step === 'gender' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 text-center mb-4">
                Almost done! Select your gender to complete your profile
              </p>

              {['Male', 'Female', 'Other'].map(g => (
                <button
                  key={g}
                  onClick={() => setGender(g as any)}
                  className={`w-full py-3 px-4 rounded-xl border-2 font-medium transition-all
                    ${gender === g 
                      ? 'bg-purple-600 text-white border-purple-600' 
                      : 'bg-gray-50 text-gray-700 border-gray-200'}`}
                >
                  {g}
                </button>
              ))}

              <button
                onClick={handleCompleteProfile}
                disabled={!gender || loading}
                className="w-full bg-purple-600 text-white py-3.5 rounded-xl font-semibold
                           text-sm hover:bg-purple-700 disabled:opacity-50 shadow-lg shadow-purple-200"
              >
                {loading ? 'Completing...' : 'Complete Profile'}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default CustomerRegister;

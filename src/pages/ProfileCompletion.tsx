import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Scissors, Eye, EyeOff, CheckCircle2, Lock, User, Phone } from 'lucide-react';

type Step = 'email' | 'phone' | 'gender' | 'password' | 'complete';
type Gender = 'Male' | 'Female' | 'Other' | null;

interface ProfileData {
  email: string;
  phone: string | null;
  gender: Gender;
  firstName: string;
  lastName: string;
}

export const ProfileCompletion = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState<Step>('email');
  
  // Profile data
  const [profileData, setProfileData] = useState<ProfileData>({
    email: '',
    phone: null,
    gender: null,
    firstName: '',
    lastName: '',
  });

  // Form states
  const [phone, setPhone] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [gender, setGender] = useState<Gender>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // OTP states
  const [phoneOtpCountdown, setPhoneOtpCountdown] = useState(0);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [processingStep, setProcessingStep] = useState(false);

  // Load profile on mount
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          navigate('/login');
          return;
        }

        const fetchPromise = supabase
          .from('customer_profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        const timeoutPromise = new Promise<any>((_, reject) => 
          setTimeout(() => reject(new Error("Profile load timeout")), 8000)
        );

        let profile;
        try {
          const result = await Promise.race([fetchPromise, timeoutPromise]);
          profile = result.data;
        } catch (fetchErr) {
          console.warn("Profile fetch timeout or error, assuming empty profile", fetchErr);
          profile = null;
        }

        if (profile) {
          setProfileData({
            email: profile.email || user.email || '',
            phone: profile.phone,
            gender: profile.gender as Gender,
            firstName: profile.first_name || '',
            lastName: profile.last_name || '',
          });

          // Determine current step based on what's completed
          if (!profile.phone) {
            setCurrentStep('phone');
          } else if (!profile.gender) {
            setCurrentStep('gender');
          } else {
            setCurrentStep('complete');
          }
        } else {
          setProfileData({
            email: user.email || '',
            phone: null,
            gender: null,
            firstName: '',
            lastName: '',
          });
          setCurrentStep('phone');
        }
      } catch (err: any) {
        toast.error('Failed to load profile');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [navigate]);

  // Calculate completion percentage
  const getCompletionPercentage = () => {
    let completed = 0;
    if (profileData.email) completed += 25; // Email
    if (profileData.phone) completed += 50; // Phone (now required to access salons)
    if (profileData.gender) completed += 25; // Gender (optional)
    if (currentStep === 'complete') completed = 100;
    return completed;
  };

  const handleSendPhoneOTP = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!phone || phone.replace(/\D/g, '').length !== 10) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }

    setProcessingStep(true);

    try {
      const formattedPhone = `+91${phone.replace(/\D/g, '').slice(-10)}`;
      
      // Check if phone already registered
      const { data: existing } = await supabase
        .from('customer_profiles')
        .select('id')
        .eq('phone', formattedPhone)
        .neq('id', (await supabase.auth.getUser()).data.user?.id || '')
        .maybeSingle();

      if (existing) {
        toast.error('This phone number is already registered');
        setProcessingStep(false);
        return;
      }

      // Send OTP via Supabase (uses Twilio backend)
      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
      });

      if (error) throw error;

      setPhoneOtpCountdown(60);
      const interval = setInterval(() => {
        setPhoneOtpCountdown(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      toast.success('OTP sent to your phone!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send OTP');
    } finally {
      setProcessingStep(false);
    }
  };

  const handleVerifyPhoneOTP = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!phoneOtp || phoneOtp.length !== 6) {
      toast.error('Enter 6-digit OTP');
      return;
    }

    setProcessingStep(true);

    try {
      const formattedPhone = `+91${phone.replace(/\D/g, '').slice(-10)}`;

      // Verify OTP with Supabase
      const { error } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: phoneOtp,
        type: 'sms',
      });

      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user');

      // Update profile with phone
      await supabase
        .from('customer_profiles')
        .upsert({
          id: user.id,
          phone: formattedPhone,
          email: profileData.email,
          first_name: profileData.firstName,
          last_name: profileData.lastName,
          gender: profileData.gender || undefined,
        });

      setProfileData(prev => ({ ...prev, phone: formattedPhone }));
      setPhoneVerified(true);
      toast.success('✓ Phone verified!');

      // Move to next step
      setTimeout(() => {
        setCurrentStep('gender');
        setPhone('');
        setPhoneOtp('');
        setPhoneVerified(false);
      }, 1000);
    } catch (err: any) {
      toast.error(err.message || 'Verification failed');
    } finally {
      setProcessingStep(false);
    }
  };

  const handleSaveGender = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!gender) {
      toast.error('Please select your gender');
      return;
    }

    setProcessingStep(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user');

      await supabase
        .from('customer_profiles')
        .upsert({
          id: user.id,
          gender,
          email: profileData.email,
          first_name: profileData.firstName,
          last_name: profileData.lastName,
          phone: profileData.phone,
        });

      setProfileData(prev => ({ ...prev, gender }));
      toast.success('✓ Gender saved!');

      setTimeout(() => {
        setCurrentStep('complete');
      }, 1000);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save gender');
    } finally {
      setProcessingStep(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Please fill all password fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }

    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }

    setProcessingStep(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast.success('✓ Password updated!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update password');
    } finally {
      setProcessingStep(false);
    }
  };

  const handleCompleteProfile = async () => {
    try {
      navigate('/salons');
    } catch (err) {
      toast.error('Navigation failed');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-50 via-white to-purple-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600" />
          <p className="text-sm text-gray-500">Loading your profile...</p>
        </div>
      </div>
    );
  }

  // ── PROGRESS INDICATOR
  const ProgressBar = () => (
    <div className="mx-auto max-w-2xl px-4 mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Profile Completion</h2>
        <span className="text-2xl font-bold text-purple-600">{getCompletionPercentage()}%</span>
      </div>
      <div className="h-3 w-full bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-purple-500 to-purple-600 transition-all duration-500"
          style={{ width: `${getCompletionPercentage()}%` }}
        />
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2">
        <div className="text-center">
          <div className={`mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full ${
            getCompletionPercentage() >= 25 ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-600'
          }`}>
            ✓
          </div>
          <p className="text-xs font-medium text-gray-700">Email</p>
        </div>
        <div className="text-center">
          <div className={`mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full ${
            getCompletionPercentage() >= 75 ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-600'
          }`}>
            {getCompletionPercentage() >= 75 ? '✓' : <Phone className="w-5 h-5" />}
          </div>
          <p className="text-xs font-medium text-gray-700">Phone</p>
        </div>
        <div className="text-center">
          <div className={`mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full ${
            getCompletionPercentage() >= 100 ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-600'
          }`}>
            {getCompletionPercentage() >= 100 ? '✓' : <User className="w-5 h-5" />}
          </div>
          <p className="text-xs font-medium text-gray-700">Gender (Optional)</p>
        </div>
        <div className="text-center">
          <div className={`mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full ${
            getCompletionPercentage() >= 100 ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-600'
          }`}>
            {getCompletionPercentage() >= 100 ? '✓' : <CheckCircle2 className="w-5 h-5" />}
          </div>
          <p className="text-xs font-medium text-gray-700">Ready</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50 py-12 px-4">
      <div className="mx-auto max-w-2xl">
        
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 
                          bg-purple-600 rounded-2xl shadow-lg shadow-purple-200 mb-4">
            <Scissors className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Complete Your Profile</h1>
          <p className="text-gray-500 text-lg mt-2">
            {currentStep === 'phone' && 'Add your verified phone number'}
            {currentStep === 'gender' && 'Tell us about yourself'}
            {currentStep === 'complete' && 'Profile complete! You\'re all set'}
          </p>
        </div>

        {/* Progress */}
        <ProgressBar />

        {/* Main Content */}
        <div className="bg-white rounded-3xl shadow-xl shadow-gray-100 p-8 border border-gray-100">
          
          {/* ── PHONE VERIFICATION */}
          {currentStep === 'phone' && (
            <form onSubmit={!phoneVerified ? handleSendPhoneOTP : handleVerifyPhoneOTP} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  📧 Email (Verified)
                </label>
                <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900">{profileData.email}</p>
                    <p className="text-sm text-gray-500">Verified during registration</p>
                  </div>
                </div>
              </div>

              {!phoneVerified ? (
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    📱 Phone Number (Required)
                  </label>
                  <p className="text-xs text-gray-500 mb-3">Enter a valid Indian phone number</p>
                  <div className="flex gap-2">
                    <div className="flex items-center px-3 py-3 bg-gray-50 border border-gray-200 
                                    rounded-xl text-sm font-medium text-gray-700 flex-shrink-0">
                      🇮🇳 +91
                    </div>
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="10-digit number"
                      maxLength={10}
                      className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm 
                                 focus:outline-none focus:ring-2 focus:ring-purple-500 
                                 focus:border-transparent transition-all"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={processingStep || !phone || phone.length !== 10}
                    className="w-full mt-4 bg-purple-600 text-white py-3 rounded-xl font-semibold 
                               text-sm hover:bg-purple-700 transition-all disabled:opacity-50
                               shadow-lg shadow-purple-200 active:scale-[0.98]"
                  >
                    {processingStep ? 'Sending OTP...' : 'Send OTP'}
                  </button>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Enter OTP
                  </label>
                  <p className="text-xs text-gray-500 mb-3">OTP sent to +91 {phone}</p>
                  <div className="flex gap-2 mb-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <input
                        key={i}
                        type="text"
                        maxLength={1}
                        value={phoneOtp[i] || ''}
                        onChange={e => {
                          const val = e.target.value.replace(/\D/g, '');
                          const newOtp = phoneOtp.split('');
                          newOtp[i] = val;
                          setPhoneOtp(newOtp.join(''));
                          if (val && e.target.nextElementSibling) {
                            (e.target.nextElementSibling as HTMLInputElement).focus();
                          }
                        }}
                        className="w-12 h-14 text-center text-lg font-bold border-2 border-gray-200 
                                   rounded-xl focus:outline-none focus:border-purple-500 transition-all"
                      />
                    ))}
                  </div>
                  <button
                    type="submit"
                    disabled={processingStep || phoneOtp.length !== 6}
                    className="w-full bg-purple-600 text-white py-3 rounded-xl font-semibold 
                               text-sm hover:bg-purple-700 transition-all disabled:opacity-50
                               shadow-lg shadow-purple-200 active:scale-[0.98]"
                  >
                    {processingStep ? 'Verifying...' : 'Verify Phone'}
                  </button>
                  <div className="mt-3 text-center">
                    {phoneOtpCountdown > 0 ? (
                      <p className="text-sm text-gray-400">Resend OTP in {phoneOtpCountdown}s</p>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSendPhoneOTP}
                        className="text-sm text-purple-600 font-medium hover:underline"
                      >
                        Resend OTP
                      </button>
                    )}
                  </div>
                </div>
              )}
            </form>
          )}

          {/* ── GENDER SELECTION */}
          {currentStep === 'gender' && (
            <form onSubmit={handleSaveGender} className="space-y-6">
              <div>
                <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl mb-6">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900">{profileData.phone}</p>
                    <p className="text-sm text-gray-500">Phone verified</p>
                  </div>
                </div>

                <label className="block text-sm font-semibold text-gray-900 mb-4">
                  👤 Select Your Gender (Optional)
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(['Male', 'Female', 'Other'] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(g === gender ? null : g)}
                      className={`py-4 rounded-xl text-sm font-semibold transition-all ${
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

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleCompleteProfile}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold 
                             text-sm hover:bg-gray-300 transition-all
                             active:scale-[0.98]"
                >
                  Skip for Now
                </button>
                <button
                  type="submit"
                  disabled={processingStep}
                  className="flex-1 bg-purple-600 text-white py-3 rounded-xl font-semibold 
                             text-sm hover:bg-purple-700 transition-all disabled:opacity-50
                             shadow-lg shadow-purple-200 active:scale-[0.98]"
                >
                  {processingStep ? 'Saving...' : 'Save & Continue'}
                </button>
              </div>
            </form>
          )}

          {/* ── PROFILE COMPLETE */}
          {currentStep === 'complete' && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-20 h-20 
                                bg-green-100 rounded-full mb-4">
                  <CheckCircle2 className="w-12 h-12 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Profile Complete! 🎉</h2>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900">Email Verified</p>
                    <p className="text-sm text-gray-600">{profileData.email}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900">Phone Verified</p>
                    <p className="text-sm text-gray-600">{profileData.phone}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900">Gender Selected</p>
                    <p className="text-sm text-gray-600">{profileData.gender}</p>
                  </div>
                </div>
              </div>

              {/* Change Password Option */}
              <div className="border-t pt-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">🔐 Change Password (Optional)</h3>
                <form onSubmit={handleChangePassword} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Current Password
                    </label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={e => setCurrentPassword(e.target.value)}
                        placeholder="••••••"
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm 
                                   focus:outline-none focus:ring-2 focus:ring-purple-500 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="••••••"
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm 
                                   focus:outline-none focus:ring-2 focus:ring-purple-500 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="••••••"
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm 
                                   focus:outline-none focus:ring-2 focus:ring-purple-500 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={processingStep || !currentPassword || !newPassword || !confirmPassword}
                    className="w-full bg-gray-600 text-white py-2 rounded-lg font-medium text-sm 
                               hover:bg-gray-700 transition-all disabled:opacity-50 mt-2"
                  >
                    {processingStep ? 'Updating...' : 'Update Password'}
                  </button>
                </form>
              </div>

              {/* Continue Button */}
              <button
                onClick={handleCompleteProfile}
                className="w-full bg-purple-600 text-white py-3.5 rounded-xl font-semibold 
                           text-sm hover:bg-purple-700 transition-all 
                           shadow-lg shadow-purple-200 active:scale-[0.98]"
              >
                Start Booking Salons →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileCompletion;

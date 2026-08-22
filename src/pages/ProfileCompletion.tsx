import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Scissors, Eye, EyeOff, CheckCircle2, Mail, User, Phone } from 'lucide-react';
import { V, VA, G, BG, DISP, BODY, MONO } from '@/components/landing/tokens';

type Step = 'email' | 'phone' | 'gender' | 'password' | 'complete';
type Gender = 'Male' | 'Female' | 'Other' | null;

interface ProfileData {
  email: string;
  phone: string | null;
  gender: Gender;
  firstName: string;
  lastName: string;
}

const fieldStyle: React.CSSProperties = {
  padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 14, outline: 'none',
  fontFamily: BODY, boxSizing: 'border-box', width: '100%',
};

const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.4)', marginBottom: 6, display: 'block',
};

const otpBoxStyle: React.CSSProperties = {
  width: 44, height: 52, textAlign: 'center', fontSize: 18, fontWeight: 700, color: '#fff',
  borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)',
  outline: 'none', fontFamily: BODY,
};

const verifiedBoxStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14,
  background: `${G}18`, border: `1px solid ${G}40`,
};

export const ProfileCompletion = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
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
    if (authLoading) return; // Wait for auth to initialize

    const loadProfile = async () => {
      console.log("PROFILE_COMPLETION: Starting loadProfile", { user: user?.id });
      try {
        if (!user) {
          console.log("PROFILE_COMPLETION: No user, navigating to login");
          navigate('/login');
          return;
        }

        console.log("PROFILE_COMPLETION: Initiating Supabase fetch...");
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
          console.log("PROFILE_COMPLETION: Waiting for fetch or timeout...");
          const result = await Promise.race([fetchPromise, timeoutPromise]);
          console.log("PROFILE_COMPLETION: Fetch resolved!", result);
          profile = result.data;
        } catch (fetchErr) {
          console.warn("PROFILE_COMPLETION: Fetch timed out or failed", fetchErr);
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
  }, [navigate, user, authLoading]);

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
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: BODY }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div className="animate-spin" style={{ height: 48, width: 48, borderRadius: '50%', border: `4px solid ${V}25`, borderTopColor: V }} />
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Loading your profile...</p>
        </div>
      </div>
    );
  }

  // ── PROGRESS INDICATOR
  const ProgressBar = () => {
    const pct = getCompletionPercentage();
    const checkpoints: Array<{ key: string; label: string; threshold: number; icon: React.ReactNode }> = [
      { key: 'email', label: 'Email', threshold: 25, icon: <Mail style={{ width: 16, height: 16 }} /> },
      { key: 'phone', label: 'Phone', threshold: 75, icon: <Phone style={{ width: 16, height: 16 }} /> },
      { key: 'gender', label: 'Gender (Optional)', threshold: 100, icon: <User style={{ width: 16, height: 16 }} /> },
      { key: 'ready', label: 'Ready', threshold: 100, icon: <CheckCircle2 style={{ width: 16, height: 16 }} /> },
    ];

    return (
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
          <h2 style={{ fontFamily: DISP, fontSize: 15, fontWeight: 700, color: '#fff' }}>Profile Completion</h2>
          <span style={{ fontFamily: MONO, fontSize: 20, fontWeight: 700, color: V }}>{pct}%</span>
        </div>
        <div style={{ height: 6, width: '100%', borderRadius: 99, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, borderRadius: 99, background: `linear-gradient(90deg, ${V}, ${VA})`, transition: 'width 0.5s ease' }} />
        </div>
        <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {checkpoints.map(cp => {
            const done = pct >= cp.threshold;
            return (
              <div key={cp.key} style={{ textAlign: 'center' }}>
                <div style={{
                  margin: '0 auto 8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  height: 36, width: 36, borderRadius: '50%',
                  background: done ? V : 'rgba(255,255,255,0.06)',
                  border: done ? 'none' : '1px solid rgba(255,255,255,0.1)',
                  color: done ? '#fff' : 'rgba(255,255,255,0.35)',
                }}>
                  {done ? <CheckCircle2 style={{ width: 16, height: 16 }} /> : cp.icon}
                </div>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.45)' }}>{cp.label}</p>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px', fontFamily: BODY, position: 'relative', overflow: 'hidden' }}>
      <div aria-hidden="true" style={{ position: 'fixed', top: '10%', right: '5%', width: 400, height: 400, borderRadius: '50%',
        background: `radial-gradient(circle, ${V}12, transparent 70%)`, filter: 'blur(60px)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 640, position: 'relative', zIndex: 10 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 60, height: 60,
            background: V, borderRadius: 20, marginBottom: 16, boxShadow: `0 8px 24px ${V}40` }}>
            <Scissors style={{ width: 28, height: 28, color: '#fff' }} />
          </div>
          <h1 style={{ fontFamily: DISP, fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>Complete Your Profile</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15, marginTop: 8 }}>
            {currentStep === 'phone' && 'Add your verified phone number'}
            {currentStep === 'gender' && 'Tell us about yourself'}
            {currentStep === 'complete' && 'Profile complete! You\'re all set'}
          </p>
        </div>

        {/* Progress */}
        <ProgressBar />

        {/* Main Content */}
        <div style={{ borderRadius: 24, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: 28, backdropFilter: 'blur(20px)' }}>

          {/* ── PHONE VERIFICATION */}
          {currentStep === 'phone' && (
            <form onSubmit={!phoneVerified ? handleSendPhoneOTP : handleVerifyPhoneOTP} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={labelStyle}>Email (Verified)</label>
                <div style={verifiedBoxStyle}>
                  <CheckCircle2 style={{ width: 18, height: 18, color: G, flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{profileData.email}</p>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Verified during registration</p>
                  </div>
                </div>
              </div>

              {!phoneVerified ? (
                <div>
                  <label style={labelStyle}>Phone Number (Required)</label>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: -2, marginBottom: 10 }}>Enter a valid Indian phone number</p>
                  <div style={{ display: 'flex' }}>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 14px',
                      borderRadius: '12px 0 0 12px', border: '1px solid rgba(255,255,255,0.1)', borderRight: 'none',
                      background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 600 }}>
                      +91
                    </span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="10-digit number"
                      maxLength={10}
                      style={{ ...fieldStyle, borderRadius: '0 12px 12px 0' }}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={processingStep || !phone || phone.length !== 10}
                    style={{ width: '100%', marginTop: 16, padding: '13px 0', borderRadius: 12,
                      background: (processingStep || !phone || phone.length !== 10) ? `${V}80` : V,
                      color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', fontFamily: BODY,
                      cursor: (processingStep || !phone || phone.length !== 10) ? 'not-allowed' : 'pointer' }}
                  >
                    {processingStep ? 'Sending OTP...' : 'Send OTP'}
                  </button>
                </div>
              ) : (
                <div>
                  <label style={labelStyle}>Enter OTP</label>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: -2, marginBottom: 12 }}>OTP sent to +91 {phone}</p>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
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
                        style={otpBoxStyle}
                      />
                    ))}
                  </div>
                  <button
                    type="submit"
                    disabled={processingStep || phoneOtp.length !== 6}
                    style={{ width: '100%', padding: '13px 0', borderRadius: 12,
                      background: (processingStep || phoneOtp.length !== 6) ? `${V}80` : V,
                      color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', fontFamily: BODY,
                      cursor: (processingStep || phoneOtp.length !== 6) ? 'not-allowed' : 'pointer' }}
                  >
                    {processingStep ? 'Verifying...' : 'Verify Phone'}
                  </button>
                  <div style={{ marginTop: 12, textAlign: 'center' }}>
                    {phoneOtpCountdown > 0 ? (
                      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>Resend OTP in {phoneOtpCountdown}s</p>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSendPhoneOTP}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: VA, fontFamily: BODY }}
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
            <form onSubmit={handleSaveGender} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <div style={{ ...verifiedBoxStyle, marginBottom: 22 }}>
                  <CheckCircle2 style={{ width: 18, height: 18, color: G, flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{profileData.phone}</p>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Phone verified</p>
                  </div>
                </div>

                <label style={labelStyle}>Select Your Gender (Optional)</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {(['Male', 'Female', 'Other'] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(g === gender ? null : g)}
                      style={{ padding: '14px 0', borderRadius: 12, fontSize: 13, fontWeight: gender === g ? 700 : 500, cursor: 'pointer',
                        border: `1px solid ${gender === g ? V : 'rgba(255,255,255,0.1)'}`,
                        background: gender === g ? `${V}28` : 'rgba(255,255,255,0.03)',
                        color: gender === g ? '#fff' : 'rgba(255,255,255,0.5)', fontFamily: BODY }}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={handleCompleteProfile}
                  style={{ flex: 1, padding: '13px 0', borderRadius: 12, background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: 14,
                    cursor: 'pointer', fontFamily: BODY }}
                >
                  Skip for Now
                </button>
                <button
                  type="submit"
                  disabled={processingStep}
                  style={{ flex: 1, padding: '13px 0', borderRadius: 12, background: processingStep ? `${V}80` : V,
                    color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', fontFamily: BODY,
                    cursor: processingStep ? 'not-allowed' : 'pointer' }}
                >
                  {processingStep ? 'Saving...' : 'Save & Continue'}
                </button>
              </div>
            </form>
          )}

          {/* ── PROFILE COMPLETE */}
          {currentStep === 'complete' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 72, height: 72,
                  borderRadius: '50%', background: `${G}18`, border: `1px solid ${G}30`, marginBottom: 14 }}>
                  <CheckCircle2 style={{ width: 40, height: 40, color: G }} />
                </div>
                <h2 style={{ fontFamily: DISP, fontSize: 22, fontWeight: 800, color: '#fff' }}>Profile Complete! 🎉</h2>
              </div>

              <div style={{ borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <CheckCircle2 style={{ width: 18, height: 18, color: G, marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>Email Verified</p>
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{profileData.email}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <CheckCircle2 style={{ width: 18, height: 18, color: G, marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>Phone Verified</p>
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{profileData.phone}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <CheckCircle2 style={{ width: 18, height: 18, color: G, marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>Gender Selected</p>
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{profileData.gender}</p>
                  </div>
                </div>
              </div>

              {/* Change Password Option */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 22 }}>
                <h3 style={{ fontFamily: DISP, fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 14 }}>Change Password (Optional)</h3>
                <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Current Password</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={e => setCurrentPassword(e.target.value)}
                        placeholder="••••••"
                        style={{ ...fieldStyle, paddingRight: 38 }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none',
                          cursor: 'pointer', color: 'rgba(255,255,255,0.35)', padding: 0, display: 'flex' }}
                      >
                        {showCurrentPassword ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>New Password</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="••••••"
                        style={{ ...fieldStyle, paddingRight: 38 }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none',
                          cursor: 'pointer', color: 'rgba(255,255,255,0.35)', padding: 0, display: 'flex' }}
                      >
                        {showNewPassword ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Confirm Password</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="••••••"
                        style={{ ...fieldStyle, paddingRight: 38 }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none',
                          cursor: 'pointer', color: 'rgba(255,255,255,0.35)', padding: 0, display: 'flex' }}
                      >
                        {showConfirmPassword ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={processingStep || !currentPassword || !newPassword || !confirmPassword}
                    style={{ width: '100%', marginTop: 4, padding: '11px 0', borderRadius: 12,
                      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                      color: '#fff', fontWeight: 600, fontSize: 13, fontFamily: BODY,
                      cursor: (processingStep || !currentPassword || !newPassword || !confirmPassword) ? 'not-allowed' : 'pointer',
                      opacity: (processingStep || !currentPassword || !newPassword || !confirmPassword) ? 0.5 : 1 }}
                  >
                    {processingStep ? 'Updating...' : 'Update Password'}
                  </button>
                </form>
              </div>

              {/* Continue Button */}
              <button
                onClick={handleCompleteProfile}
                style={{ width: '100%', padding: '15px 0', borderRadius: 12, background: V, color: '#fff',
                  fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer', fontFamily: BODY }}
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

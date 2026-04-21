import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Eye, EyeOff, Mail, Lock, User, Phone } from 'lucide-react';

const calculateCompletion = (fields: { firstName?: string; lastName?: string; email?: string; phone?: string; gender?: string }): number => {
  const filled = Object.values(fields).filter(Boolean).length;
  return Math.round((filled / 5) * 100);
};

export default function CustomerRegister() {
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
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other' | ''>('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password.trim()) {
      toast.error('First name, last name, email, and password are required');
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      // Check if phone already exists (if provided)
      if (phone) {
        const phoneDigits = phone.replace(/\D/g, '');
        const phoneFormatted = `+91${phoneDigits}`;
        const { data: existing } = await supabase
          .from('customer_profiles')
          .select('id')
          .eq('phone', phoneFormatted)
          .maybeSingle();

        if (existing) {
          toast.error('This phone number is already registered');
          setLoading(false);
          return;
        }
      }

      // Sign up with Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        toast.error(error.message || 'Registration failed');
        setLoading(false);
        return;
      }

      if (!data.user) {
        toast.error('User creation failed');
        setLoading(false);
        return;
      }

      // Insert customer profile
      const profileData = {
        id: data.user.id,
        email,
        first_name: firstName,
        last_name: lastName,
        phone: phone ? `+91${phone.replace(/\D/g, '')}` : null,
        gender: gender || null,
        profile_complete_pct: calculateCompletion({ firstName, lastName, email, phone, gender }),
      };

      const { error: profileError } = await supabase
        .from('customer_profiles')
        .insert([profileData]);

      if (profileError) {
        toast.error(profileError.message || 'Failed to create profile');
        setLoading(false);
        return;
      }

      toast.success('Account created! Please sign in.');
      navigate('/login');
    } catch (err: any) {
      toast.error(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const completion = calculateCompletion({ firstName, lastName, email, phone, gender });

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 sm:p-8" style={{ background: 'linear-gradient(135deg, #f3f4f5 0%, #eaddff 100%)' }}>
      
      {/* Brand Anchor Point */}
      <div className="mb-8 text-center">
        <span className="text-3xl font-black text-[#630ed4] tracking-[-0.04em] font-headline">Snippr</span>
        <p className="text-[#4a4455] text-sm mt-1 font-medium tracking-wide">Elevated Grooming Experience</p>
      </div>

      {/* Main Registration Card */}
      <main className="w-full max-w-lg bg-white rounded-2xl shadow-[0_20px_40px_rgba(99,14,212,0.06)] p-8 md:p-10">
        
        {/* Progress Indicator */}
        <header className="flex flex-col items-center mb-10">
          <div className="flex items-center gap-2 mb-3">
             <div className="h-2 w-8 bg-[#630ed4] rounded-full"></div>
             <div className="h-2 w-2 bg-[#e7e8e9] rounded-full"></div>
             <div className="h-2 w-2 bg-[#e7e8e9] rounded-full"></div>
          </div>
          <span className="text-xs font-bold text-[#630ed4] tracking-widest uppercase">Step 1 of 1</span>
          <h1 className="text-2xl font-extrabold text-[#191c1d] mt-4 tracking-tight">Create your profile</h1>
          <p className="text-[#4a4455] text-sm mt-1">Join the elite circle of groomed gentlemen.</p>
        </header>

        {/* Registration Form */}
        <form onSubmit={handleRegister} className="space-y-6">
          
          {/* Two-column row: First & Last Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[#4a4455] uppercase tracking-wider ml-1">First Name</label>
              <input 
                type="text" 
                value={firstName} 
                onChange={(e) => setFirstName(e.target.value)} 
                placeholder="John" 
                disabled={loading}
                className="w-full bg-[#e7e8e9] border-none rounded-lg px-4 py-3.5 text-[#191c1d] focus:ring-2 focus:ring-[#630ed4] focus:bg-white transition-all placeholder:text-[#7b7487]" 
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[#4a4455] uppercase tracking-wider ml-1">Last Name</label>
              <input 
                type="text" 
                value={lastName} 
                onChange={(e) => setLastName(e.target.value)} 
                placeholder="Doe" 
                disabled={loading}
                className="w-full bg-[#e7e8e9] border-none rounded-lg px-4 py-3.5 text-[#191c1d] focus:ring-2 focus:ring-[#630ed4] focus:bg-white transition-all placeholder:text-[#7b7487]" 
              />
            </div>
          </div>

          {/* Email Field */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-[#4a4455] uppercase tracking-wider ml-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7b7487] w-5 h-5" />
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="john.doe@luxury.com" 
                disabled={loading}
                className="w-full bg-[#e7e8e9] border-none rounded-lg pl-12 pr-4 py-3.5 text-[#191c1d] focus:ring-2 focus:ring-[#630ed4] focus:bg-white transition-all placeholder:text-[#7b7487]" 
              />
            </div>
          </div>

          {/* Phone Number Field with fixed +91 */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-[#4a4455] uppercase tracking-wider ml-1">Phone Number</label>
            <div className="flex">
              <span className="flex items-center justify-center bg-[#e1e3e4] text-[#4a4455] px-4 py-3.5 rounded-l-lg border-r border-[#ccc3d8]/20 font-semibold text-sm">
                +91
              </span>
              <input 
                type="tel" 
                value={phone} 
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} 
                placeholder="98765 43210" 
                disabled={loading}
                className="w-full bg-[#e7e8e9] border-none rounded-r-lg px-4 py-3.5 text-[#191c1d] focus:ring-2 focus:ring-[#630ed4] focus:bg-white transition-all placeholder:text-[#7b7487]" 
              />
            </div>
          </div>

          {/* Gender Selection Pill Buttons */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-[#4a4455] uppercase tracking-wider ml-1">Gender Identification</label>
            <div className="grid grid-cols-3 gap-3">
              {['Male', 'Female', 'Other'].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGender(g as any)}
                  disabled={loading}
                  className={`flex items-center justify-center py-2.5 px-4 rounded-full border text-sm font-medium transition-all active:scale-95 ${
                    gender === g
                      ? 'bg-[#d2bbff] text-[#25005a] border-transparent font-bold ring-1 ring-[#630ed4]/20 shadow-sm'
                      : 'border-[#ccc3d8]/50 text-[#4a4455] hover:bg-[#630ed4]/5 hover:border-[#630ed4]'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Password and Confirm Password */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[#4a4455] uppercase tracking-wider ml-1">Password</label>
              <div className="relative">
                 <input 
                   type={showPassword ? 'text' : 'password'} 
                   value={password} 
                   onChange={(e) => setPassword(e.target.value)} 
                   placeholder="••••••••" 
                   disabled={loading}
                   className="w-full bg-[#e7e8e9] border-none rounded-lg pl-4 pr-10 py-3.5 text-[#191c1d] focus:ring-2 focus:ring-[#630ed4] focus:bg-white transition-all placeholder:text-[#7b7487]" 
                 />
                 <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7b7487] hover:text-[#4a4455]"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[#4a4455] uppercase tracking-wider ml-1">Confirm</label>
              <div className="relative">
                 <input 
                   type={showConfirmPassword ? 'text' : 'password'} 
                   value={confirmPassword} 
                   onChange={(e) => setConfirmPassword(e.target.value)} 
                   placeholder="••••••••" 
                   disabled={loading}
                   className="w-full bg-[#e7e8e9] border-none rounded-lg pl-4 pr-10 py-3.5 text-[#191c1d] focus:ring-2 focus:ring-[#630ed4] focus:bg-white transition-all placeholder:text-[#7b7487]" 
                 />
                 <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7b7487] hover:text-[#4a4455]"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
              </div>
            </div>
          </div>

          {/* Primary CTA */}
          <div className="pt-4">
            <button 
              type="submit" 
              disabled={loading}
              className="w-full text-white font-bold py-4 rounded-full shadow-lg hover:shadow-xl hover:opacity-95 transition-all transform active:scale-[0.98] tracking-tight disabled:bg-gray-400"
              style={{ background: loading ? '#ccc3d8' : 'linear-gradient(45deg, #630ed4 0%, #7c3aed 100%)' }}
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </div>
        </form>

        {/* Footer Link */}
        <footer className="mt-8 text-center">
          <p className="text-[#4a4455] text-sm">
            Already part of the community? 
            <Link to="/login" className="text-[#630ed4] font-bold hover:underline ml-1">Sign In</Link>
          </p>
        </footer>
      </main>

    </div>
  );
}

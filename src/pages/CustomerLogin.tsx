import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Eye, EyeOff, Mail, Lock, Chrome } from 'lucide-react';

export default function CustomerLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

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
          navigate('/salons');
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
    <div className="relative min-h-screen overflow-hidden bg-[#faf9fc] px-6 py-10 text-[#1a1c1e]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_10%,_rgba(111,76,208,0.08),_transparent_34%),radial-gradient(circle_at_84%_16%,_rgba(255,107,53,0.08),_transparent_36%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,_rgba(79,55,138,0.08)_0.8px,transparent_0.8px)] [background-size:32px_32px] opacity-45" />

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-[440px] flex-col items-center justify-center">
        <div className="mb-10 flex flex-col items-center text-center">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#6750a4] to-[#4f378a] shadow-[0_12px_32px_rgba(79,55,138,0.2)]">
            <span className="text-3xl text-white" style={{ fontVariationSettings: '"FILL" 1' }}>
              ✂
            </span>
          </div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-[#1a1c1e] sm:text-[1.75rem]">
            Snippr - Log In
          </h1>
          <p className="mt-2 text-sm font-medium text-[#494551]">Precision in every second.</p>
        </div>

        <section className="w-full rounded-[24px] border border-[#cbc4d2]/50 bg-white px-8 py-8 shadow-[0px_12px_32px_rgba(79,55,138,0.06)] sm:px-12 sm:py-12">
          <form onSubmit={handleEmailLogin} className="space-y-8">
            <div className="space-y-2">
              <label className="ml-1 block text-[11px] font-bold uppercase tracking-[0.24em] text-[#494551]">
                Email address
              </label>
              <div className="flex h-14 items-center gap-3 rounded-[16px] bg-[#f4f3f6] px-4 transition-all focus-within:bg-white focus-within:ring-2 focus-within:ring-[#6750a4]">
                <Mail className="h-5 w-5 shrink-0 text-[#7a7582]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-full w-full border-0 bg-transparent text-sm font-medium text-[#1a1c1e] placeholder:text-transparent focus:outline-none"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <label className="block text-[11px] font-bold uppercase tracking-[0.24em] text-[#494551]">
                  Password
                </label>
                <Link to="/forgot-password" className="text-[11px] font-bold text-[#6750a4] hover:underline">
                  Forgot?
                </Link>
              </div>
              <div className="flex h-14 items-center gap-3 rounded-[16px] bg-[#f4f3f6] px-4 transition-all focus-within:bg-white focus-within:ring-2 focus-within:ring-[#6750a4]">
                <Lock className="h-5 w-5 shrink-0 text-[#7a7582]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-full w-full border-0 bg-transparent text-sm font-medium text-[#1a1c1e] placeholder:text-transparent focus:outline-none"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="rounded-full p-1 text-[#7a7582] transition-colors hover:text-[#4f378a]"
                  disabled={loading}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-[16px] bg-gradient-to-br from-[#6750a4] to-[#4f378a] font-bold text-white shadow-[0_12px_32px_rgba(79,55,138,0.2)] transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
            >
              {loading ? 'Signing in...' : 'Get Started'}
              {!loading && <span className="text-lg leading-none">→</span>}
            </button>
          </form>

          <div className="mt-8 flex items-center gap-3">
            <div className="h-px flex-1 bg-[#cbc4d2]/40" />
            <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#494551]">Or</span>
            <div className="h-px flex-1 bg-[#cbc4d2]/40" />
          </div>

          <button
            onClick={handleGoogle}
            disabled={loading}
            className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-[14px] border border-[#cbc4d2]/80 bg-[#faf9fc] text-sm font-semibold text-[#1a1c1e] transition-all hover:border-[#7a7582] hover:bg-white disabled:opacity-60"
          >
            <Chrome className="h-5 w-5" />
            Continue with Google
          </button>

          <div className="mt-8 flex flex-col items-center gap-4 text-center">
            <p className="text-xs leading-relaxed text-[#494551]">
              By continuing, you agree to our <a className="font-semibold text-[#1a1c1e] underline decoration-[#6750a4]/30" href="#">Terms of Service</a> and <a className="font-semibold text-[#1a1c1e] underline decoration-[#6750a4]/30" href="#">Privacy Policy</a>.
            </p>
            <div className="h-px w-12 bg-[#cbc4d2]/30" />
            <p className="flex items-center gap-1.5 text-xs font-bold text-[#ab3500]">
              <span className="text-[16px]">●</span>
              Welcome back!
            </p>
          </div>
        </section>

        <div className="mt-12 flex items-center gap-8 text-[#7a7582] opacity-45 grayscale transition-all duration-500 hover:opacity-100 hover:grayscale-0">
          <div className="flex items-center gap-2 text-sm font-bold">
            <span className="text-lg"></span>
            <span>App Store</span>
          </div>
          <div className="flex items-center gap-2 text-sm font-bold">
            <span className="text-lg">▶</span>
            <span>Play Store</span>
          </div>
        </div>
      </main>
    </div>
  );
}

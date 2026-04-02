import { useState, useEffect } from "react";
import { Mail, Phone, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface OTPLoginProps {
  initialError?: string | null;
}

const OTPLogin = ({ initialError }: OTPLoginProps) => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"email" | "phone">("email");
  const [emailSent, setEmailSent] = useState(false);
  const [authError, setAuthError] = useState<string | null>(initialError || null);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialError) setAuthError(initialError);
  }, [initialError]);

  const resetToLogin = () => {
    setAuthError(null);
    setEmailSent(false);
    setMode("email");
    // Clean hash from URL gracefully
    window.history.replaceState(null, "", window.location.pathname);
  };

  const handleEmailOTP = async () => {
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      toast.error("Please enter a valid email address");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth` }
    });
    setLoading(false);
    
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Magic link sent!");
      setEmailSent(true);
    }
  };

  const handlePhoneOTP = async () => {
    if (!phone || phone.length < 10) {
      toast.error("Please enter a valid phone number");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ phone });
    setLoading(false);
    
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("OTP sent to your phone");
      localStorage.setItem("snippr_auth_phone", phone);
      navigate("/verify");
    }
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth`
      }
    });
    if (error) toast.error(error.message);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="w-full overflow-hidden rounded-2xl border border-border bg-card/95 p-8 shadow-sm backdrop-blur-xl sm:p-10"
    >
      <AnimatePresence mode="wait">
        
        {/* Error State */}
        {authError ? (
          <motion.div
            key="error-state"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="flex flex-col items-center text-center space-y-6"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 dark:bg-red-500/10">
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                Link Expired
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-[280px]">
                {authError}
              </p>
            </div>
            <Button
              onClick={resetToLogin}
              className="mt-2 h-11 w-full rounded-xl bg-primary font-medium text-primary-foreground hover:brightness-110 transition-all"
            >
              Retry Login
            </Button>
          </motion.div>
        ) : 

        /* Success State */
        emailSent && mode === "email" ? (
          <motion.div
            key="success-state"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="flex flex-col items-center text-center space-y-6"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
              <CheckCircle2 className="h-8 w-8 text-zinc-900 dark:text-zinc-50" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                Check your email
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-[280px]">
                We've sent a secure login link to <br/>
                <span className="font-medium text-zinc-900 dark:text-zinc-200">{email}</span>
              </p>
            </div>
            
            <div className="w-full flex flex-col gap-3 pt-2">
              <Button
                onClick={handleEmailOTP}
                disabled={loading}
                variant="outline"
                className="h-11 w-full rounded-xl border-zinc-200 font-medium text-zinc-700 hover:bg-zinc-50"
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Resend email
              </Button>
              <button
                onClick={() => setEmailSent(false)}
                className="text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                Change email
              </button>
            </div>
          </motion.div>
        ) : 

        /* Login Form */
        (
          <motion.div
            key="login-form"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
          >
            <div className="mb-6 flex flex-col items-center space-y-1.5 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 text-white shadow-sm">
                <svg className="h-6 w-6 text-zinc-900 dark:text-zinc-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">
                Welcome to Snippr
              </h2>
              <p className="text-sm text-muted-foreground">
                Sign in to track queues and bookings in real time.
              </p>
            </div>

            <AnimatePresence mode="wait">
              {mode === "email" ? (
                <motion.div
                  key="email-input"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-4"
                >
                  <Input
                    autoFocus
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 rounded-xl"
                    type="email"
                    onKeyDown={(e) => e.key === "Enter" && handleEmailOTP()}
                  />
                  <Button
                    onClick={handleEmailOTP}
                    disabled={loading || !email}
                    className="h-11 w-full rounded-xl bg-gradient-to-r from-primary to-indigo-500 text-sm font-medium text-primary-foreground shadow-sm hover:brightness-110 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue"}
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="phone-input"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-4"
                >
                  <Input
                    autoFocus
                    placeholder="Enter your number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-11 rounded-xl"
                    type="tel"
                    onKeyDown={(e) => e.key === "Enter" && handlePhoneOTP()}
                  />
                  <Button
                    onClick={handlePhoneOTP}
                    disabled={loading || phone.length < 5}
                    className="h-11 w-full rounded-xl bg-gradient-to-r from-primary to-indigo-500 text-sm font-medium text-primary-foreground shadow-sm hover:brightness-110 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Get Started"}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
              <button onClick={() => toast.info("Password reset is coming soon")}>Forgot password?</button>
              <Link to="/owner-register" className="font-medium text-primary hover:underline">Register</Link>
            </div>

            <div className="my-6 flex items-center justify-center space-x-3 text-xs text-zinc-400">
              <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
              <span className="uppercase tracking-wider">or</span>
              <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
            </div>

            <div className="space-y-3">
              {mode === "phone" && (
                <button
                  onClick={() => {
                    setMode("email");
                  }}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm font-medium text-foreground transition-all hover:bg-muted"
                >
                  <Mail className="h-4 w-4 text-zinc-500" />
                  Continue with Email
                </button>
              )}
              
              {mode === "email" && (
                <button
                  onClick={() => setMode("phone")}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm font-medium text-foreground transition-all hover:bg-muted"
                >
                  <Phone className="h-4 w-4 text-zinc-500" />
                  Continue with Phone
                </button>
              )}

              <button
                onClick={handleGoogleLogin}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm font-medium text-foreground transition-all hover:bg-muted"
              >
                <svg className="h-4 w-4" aria-hidden="true" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Google
              </button>

              <p className="pt-2 text-center text-xs text-zinc-500">
                By continuing, you agree to our Terms of Service and Privacy Policy.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default OTPLogin;

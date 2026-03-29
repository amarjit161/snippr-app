import { useState } from "react";
import { Mail, Phone, Loader2, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const OTPLogin = () => {
  const [mode, setMode] = useState<"email" | "phone">("email");
  const [phoneStep, setPhoneStep] = useState<"phone" | "otp">("phone");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const handleEmailOTP = async () => {
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      toast.error("Please enter a valid email address");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin }
    });
    
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Magic link sent! Please check your email inbox.");
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
      toast.success("OTP sent to your phone!");
      setPhoneStep("otp");
    }
  };

  const handleVerifyPhoneOTP = async () => {
    if (!otp || otp.length < 6) {
      toast.error("Please enter a 6-digit OTP");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      phone,
      token: otp,
      type: "sms",
    });
    setLoading(false);
    
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Welcome to Snippr!");
    }
  };

  const handleGoogleLogin = async () => {
    console.log("Initiating Google Login using Supabase default callback...");
    const { error } = await supabase.auth.signInWithOAuth({ 
      provider: "google"
    });

    if (error) {
      console.error("Google login error:", error.message);
      toast.error(error.message);
    }
  };

  return (
    <div className="flex w-full items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-[26rem] overflow-hidden rounded-[2rem] bg-white p-8 shadow-[0_8px_30px_rgb(0,0,0,0.08)] sm:p-10 dark:bg-zinc-900 dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)]"
      >
        <div className="mb-8 text-center space-y-2">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Login to Snippr
          </h2>
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Welcome back. Please connect to continue.
          </p>
        </div>

        <AnimatePresence mode="wait">
          {mode === "email" ? (
            <motion.div
              key="email"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4"
            >
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
                <Input
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-14 rounded-2xl border-zinc-200 bg-zinc-50 pl-12 text-base outline-none transition-all placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-0 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-50 dark:focus:border-zinc-50"
                  type="email"
                />
              </div>
              <Button
                onClick={handleEmailOTP}
                disabled={loading}
                className="h-14 w-full rounded-2xl bg-zinc-900 text-base font-medium tracking-wide text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Send OTP"}
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="phone"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4"
            >
              <AnimatePresence mode="wait">
                {phoneStep === "phone" ? (
                  <motion.div
                    key="input-phone"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-4"
                  >
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
                      <Input
                        placeholder="Enter phone number"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="h-14 rounded-2xl border-zinc-200 bg-zinc-50 pl-12 text-base outline-none transition-all placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-0 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-50 dark:focus:border-zinc-50"
                        type="tel"
                      />
                    </div>
                    <Button
                      onClick={handlePhoneOTP}
                      disabled={loading}
                      className="h-14 w-full rounded-2xl bg-zinc-900 text-base font-medium tracking-wide text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                    >
                      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Send OTP"}
                    </Button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="input-otp"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-4"
                  >
                    <div className="relative">
                      <KeyRound className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
                      <Input
                        placeholder="Enter 6-digit OTP"
                        value={otp}
                        maxLength={6}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        className="h-14 rounded-2xl border-zinc-200 bg-zinc-50 pl-12 text-center text-lg font-mono tracking-[0.5em] outline-none transition-all placeholder:tracking-normal placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-0 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-50 dark:focus:border-zinc-50"
                        type="text"
                      />
                    </div>
                    <Button
                      onClick={handleVerifyPhoneOTP}
                      disabled={loading}
                      className="h-14 w-full rounded-2xl bg-zinc-900 text-base font-medium tracking-wide text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                    >
                      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Verify OTP"}
                    </Button>
                    <button
                      onClick={() => setPhoneStep("phone")}
                      className="w-full text-center text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
                    >
                      Change phone number
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="my-8 flex items-center justify-center space-x-4">
          <div className="h-px flex-1 bg-zinc-100 dark:bg-zinc-800" />
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">or use</span>
          <div className="h-px flex-1 bg-zinc-100 dark:bg-zinc-800" />
        </div>

        <div className="flex justify-center gap-3">
          <button
            onClick={() => {
              setMode("email");
              setPhoneStep("phone");
            }}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition-all ${
              mode === "email"
                ? "border-zinc-900 bg-zinc-900 text-white shadow-sm dark:border-white dark:bg-white dark:text-zinc-900"
                : "border-zinc-200 bg-transparent text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800/50"
            }`}
          >
            <Mail className="h-4 w-4" />
            Email
          </button>
          
          <button
            onClick={() => setMode("phone")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition-all ${
              mode === "phone"
                ? "border-zinc-900 bg-zinc-900 text-white shadow-sm dark:border-white dark:bg-white dark:text-zinc-900"
                : "border-zinc-200 bg-transparent text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800/50"
            }`}
          >
            <Phone className="h-4 w-4" />
            Phone
          </button>
          
          <button
            onClick={handleGoogleLogin}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-transparent px-3 py-3 text-sm font-semibold text-zinc-600 transition-all hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800/50"
          >
            <svg className="h-4 w-4" aria-hidden="true" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Google
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default OTPLogin;

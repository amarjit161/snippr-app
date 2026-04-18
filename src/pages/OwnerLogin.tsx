import { FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Lock, Mail, Store } from "lucide-react";
import TurnstileCaptcha, { type TurnstileCaptchaHandle } from "@/components/TurnstileCaptcha";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { useAuth } from "@/contexts/AuthContext";
import gsap from "gsap";

type OwnerRecord = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  is_verified: boolean;
  is_active: boolean;
};

export default function OwnerLogin() {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading, profileLoading } = useAuth();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSentTo, setForgotSentTo] = useState<string | null>(null);
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [verifyingCaptcha, setVerifyingCaptcha] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileCaptchaHandle | null>(null);
  const loginCardRef = useRef<HTMLDivElement | null>(null);
  const flipInnerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!authLoading && user) {
      if (profile) {
        console.log("OWNER_LOGIN: User already authenticated with profile, redirecting to Dashboard");
        navigate("/owner-dashboard", { replace: true });
      } else if (!profileLoading && !profile) {
        console.log("OWNER_LOGIN: User authenticated but NO profile found, redirecting to Registration to resume setup");
        navigate("/owner-register", { replace: true });
      }
    }
  }, [user, profile, authLoading, profileLoading, navigate]);

  useEffect(() => {
    if (!loginCardRef.current) return;

    gsap.fromTo(
      loginCardRef.current,
      { opacity: 0, y: 18, scale: 0.985 },
      { opacity: 1, y: 0, scale: 1, duration: 0.35, ease: "power2.out" }
    );
  }, []);

  useEffect(() => {
    if (!flipInnerRef.current) return;
    gsap.to(flipInnerRef.current, {
      rotateY: isForgotMode ? 180 : 0,
      duration: 0.45,
      ease: "power2.inOut",
    });

    if (isForgotMode) {
      loginCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isForgotMode]);

  const resetCaptcha = () => {
    setCaptchaToken(null);
    turnstileRef.current?.reset();
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (loading || verifyingCaptcha) return;

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      toast.error("Please enter email and password");
      return;
    }

    console.log("LOGIN_ATTEMPT");
    setVerifyingCaptcha(true);

    const token = turnstileRef.current?.getResponse() || "";
    if (!token) {
      toast.error("Invalid or expired captcha");
      resetCaptcha();
      setVerifyingCaptcha(false);
      return;
    }

    const captchaResult = await verifyTurnstileToken(token);
    if (!captchaResult.success) {
      toast.error(captchaResult.message || "Captcha verification failed");
      resetCaptcha();
      setVerifyingCaptcha(false);
      return;
    }

    resetCaptcha();
    setVerifyingCaptcha(false);
    setLoading(true);

    try {
      console.log("AUTH_SIGNIN_START", trimmedEmail);
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: trimmedPassword,
      });

      if (authError) {
        console.error("AUTH_SIGNIN_ERROR:", authError.message);
        toast.error(authError.message || "Invalid credentials");
        setLoading(false);
        return;
      }

      console.log("AUTH_SIGNIN_SUCCESS", authData.user?.id);
      
      // Wait a moment for AuthContext to sync up if it hasn't yet
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log("PROFILE_FETCH_START");
      const { data: ownerProfile, error: profileError } = await supabase
        .from("owners")
        .select("*")
        .eq("id", authData.user!.id)
        .maybeSingle();
 
      if (profileError) {
        console.error("PROFILE_FETCH_ERROR:", profileError.message);
        throw profileError;
      }

      if (!ownerProfile) {
        console.log("PROFILE_NOT_FOUND - Transitioning to Register");
        toast.info("Profile setup incomplete. Redirecting...");
        navigate("/owner-register", { replace: true });
        return;
      }

      console.log("PROFILE_FETCH_SUCCESS", ownerProfile.id);
      localStorage.setItem("owner", JSON.stringify(ownerProfile));

      console.log("SALON_FETCH_START");
      const { data: existingSalon } = await supabase
        .from("salons")
        .select("*")
        .eq("owner_id", ownerProfile.id)
        .maybeSingle();

      console.log("LOGIN_COMPLETE", { hasSalon: !!existingSalon });
      toast.success("Welcome back");
      navigate(existingSalon ? "/owner-dashboard" : "/register-salon", { replace: true });
    } catch (error: any) {
      console.error("LOGIN_PIPELINE_ERROR:", error.message || error);
      toast.error(error.message || "Login failed");
    } finally {
      // Small delay before removing the loading state to allow unmount to happen cleanly
      setTimeout(() => setLoading(false), 1000);
    }
  };

  const handleForgotPasswordSend = async () => {
    const requestedEmail = forgotEmail.trim().toLowerCase();
    if (!requestedEmail) {
      toast.error("Email is required to send reset link.");
      return;
    }

    if (requestedEmail !== email.trim()) {
      setEmail(requestedEmail);
    }

    setForgotLoading(true);
    try {
      const { data: ownerRecord, error: ownerError } = await supabase
        .from("owners")
        .select("id, email")
        .eq("email", requestedEmail)
        .maybeSingle();

      if (ownerError) {
        toast.error("Unable to verify owner account right now.");
        return;
      }

      if (!ownerRecord) {
        toast.error("This email is not registered as a salon owner.");
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(requestedEmail, {
        redirectTo: `${window.location.origin}/auth/callback?flow=recovery`,
      });

      if (error) {
        toast.error(error.message || "Unable to send reset email.");
        return;
      }

      setForgotSentTo(requestedEmail);
      toast.success("Password reset link sent to your email.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleForgotPasswordOpen = () => {
    setForgotEmail(email.trim());
    setIsForgotMode(true);
  };

  const handleBackToLogin = () => {
    setIsForgotMode(false);
  };

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div ref={loginCardRef} className="mx-auto max-w-md [perspective:1200px]">
        <div
          ref={flipInnerRef}
          className="relative min-h-[560px] [transform-style:preserve-3d]"
          style={{ transform: "rotateY(0deg)" }}
        >
          <div className="absolute inset-0 rounded-xl border border-gray-200 bg-white p-8 shadow-sm [backface-visibility:hidden]">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-green-600">
                <Store className="h-6 w-6" />
              </div>
              <h1 className="font-display text-2xl font-bold">Owner Login</h1>
              <p className="mt-1 text-sm text-muted-foreground">Sign in to manage your salon account.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="Owner email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>

              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleForgotPasswordOpen}
                  disabled={forgotLoading}
                  className="text-xs font-medium text-primary hover:underline disabled:opacity-60"
                  onMouseEnter={(e) => {
                    gsap.to(e.currentTarget, { y: -1, textShadow: "0 0 8px rgba(99,102,241,0.35)", duration: 0.16, ease: "power2.out" });
                  }}
                  onMouseLeave={(e) => {
                    gsap.to(e.currentTarget, { y: 0, textShadow: "0 0 0 rgba(99,102,241,0)", duration: 0.16, ease: "power2.out" });
                  }}
                >
                  Forgot password?
                </button>
              </div>

              {forgotSentTo && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                  Reset link sent to <span className="font-semibold">{forgotSentTo}</span>.
                  Open the email, click the link, set new password, then return to owner login.
                </div>
              )}

              <TurnstileCaptcha ref={turnstileRef} onTokenChange={setCaptchaToken} className="min-h-[78px]" />

              <Button type="submit" disabled={loading || verifyingCaptcha || !captchaToken} className="h-11 w-full rounded-xl">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Login"}
              </Button>
            </form>

            <p className="mt-4 text-center text-sm">
              New salon owner?
              <span
                className="ml-1 cursor-pointer font-medium text-primary"
                onClick={() => navigate("/owner-signup")}
              >
                Create Account
              </span>
            </p>
          </div>

          <div
            className="absolute inset-0 rounded-xl border border-gray-200 bg-white p-8 shadow-sm [backface-visibility:hidden]"
            style={{ transform: "rotateY(180deg)" }}
          >
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Lock className="h-6 w-6" />
              </div>
              <h1 className="font-display text-2xl font-bold">Reset Password</h1>
              <p className="mt-1 text-sm text-muted-foreground">Enter owner email to receive reset link.</p>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="Owner email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 flex-1"
                  onClick={handleBackToLogin}
                  disabled={forgotLoading}
                >
                  Back to login
                </Button>
                <Button
                  type="button"
                  className="h-10 flex-1"
                  onClick={handleForgotPasswordSend}
                  disabled={forgotLoading}
                  onMouseEnter={(e) => {
                    gsap.to(e.currentTarget, { y: -1, boxShadow: "0 10px 22px rgba(99,102,241,0.22)", duration: 0.18, ease: "power2.out" });
                  }}
                  onMouseLeave={(e) => {
                    gsap.to(e.currentTarget, { y: 0, boxShadow: "0 0 0 rgba(99,102,241,0)", duration: 0.18, ease: "power2.out" });
                  }}
                >
                  {forgotLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send link"}
                </Button>
              </div>

              {forgotSentTo && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                  Reset link sent to <span className="font-semibold">{forgotSentTo}</span>.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

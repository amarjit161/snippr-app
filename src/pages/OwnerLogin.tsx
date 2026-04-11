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
  const { user, profile, loading: authLoading } = useAuth();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifyingCaptcha, setVerifyingCaptcha] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileCaptchaHandle | null>(null);

  useEffect(() => {
    if (!authLoading && user && profile) {
      console.log("OWNER_LOGIN: User already authenticated with profile, redirecting...");
      navigate("/owner-dashboard", { replace: true });
    }
  }, [user, profile, authLoading, navigate]);

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
        return;
      }

      if (!authData.user) {
        throw new Error("Login failed to retrieve user");
      }

      console.log("AUTH_SIGNIN_SUCCESS", authData.user.id);

      console.log("PROFILE_FETCH_START");
      const { data: profile, error: profileError } = await supabase
        .from("owners")
        .select("*")
        .eq("id", authData.user.id)
        .maybeSingle();
 
      if (profileError) {
        console.error("PROFILE_FETCH_ERROR:", profileError.message);
        throw profileError;
      }

      if (!profile) {
        console.log("PROFILE_NOT_FOUND");
        toast.error("Owner profile not found. Please contact support.");
        return;
      }

      console.log("PROFILE_FETCH_SUCCESS", profile.id);

      const normalizedOwner: OwnerRecord = profile as any;
      localStorage.setItem("owner", JSON.stringify(normalizedOwner));

      console.log("SALON_FETCH_START");
      const { data: existingSalon } = await supabase
        .from("salons")
        .select("*")
        .eq("owner_id", normalizedOwner.id)
        .maybeSingle();

      console.log("LOGIN_COMPLETE", { hasSalon: !!existingSalon });
      toast.success("Welcome back");
      navigate(existingSalon ? "/owner-dashboard" : "/register-salon", { replace: true });
    } catch (error: any) {
      console.error("LOGIN_PIPELINE_ERROR:", error.message || error);
      toast.error(error.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
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

          <TurnstileCaptcha ref={turnstileRef} onTokenChange={setCaptchaToken} className="min-h-[78px]" />

          <Button type="submit" disabled={loading || verifyingCaptcha || !captchaToken} className="h-11 w-full rounded-xl">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Login"}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm">
          New salon owner?
          <span
            className="ml-1 cursor-pointer font-medium text-primary"
            onClick={() => navigate("/owner-register")}
          >
            Register your salon
          </span>
        </p>
      </div>
    </div>
  );
}

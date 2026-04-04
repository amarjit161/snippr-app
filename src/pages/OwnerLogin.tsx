import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Lock, Mail, Store } from "lucide-react";
import TurnstileCaptcha from "@/components/TurnstileCaptcha";
import { verifyTurnstileToken } from "@/lib/turnstile";

type OwnerRecord = {
  id: string;
  email: string;
  password: string;
  owner_name: string;
  name?: string | null;
  phone: string | null;
  is_verified?: boolean;
};

export default function OwnerLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);

  const resetCaptcha = () => {
    setCaptchaToken(null);
    setCaptchaResetKey((current) => current + 1);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (loading) return;

    if (!captchaToken) {
      toast.error("Please complete the captcha");
      return;
    }

    const captchaResult = await verifyTurnstileToken(captchaToken);
    if (!captchaResult.success) {
      toast.error(captchaResult.message || "Captcha verification failed");
      resetCaptcha();
      return;
    }

    resetCaptcha();
    setLoading(true);

    try {
      const { data, error } = (await supabase
        .from("owners" as any)
        .select("*")
        .eq("email", email.trim())
        .eq("password", password)
        .maybeSingle()) as any;

      if (error) {
        throw error;
      }

      if (!data) {
        toast.error("Invalid credentials");
        return;
      }

      const normalizedOwner: OwnerRecord = {
        ...(data as OwnerRecord),
        owner_name: (data?.owner_name || data?.name || "Owner") as string,
      };

      localStorage.setItem("owner", JSON.stringify(normalizedOwner));

      const { data: existingSalon } = await supabase
        .from("salons")
        .select("*")
        .eq("owner_id", normalizedOwner.id)
        .maybeSingle();

      toast.success("Welcome back");
      navigate(existingSalon ? "/owner-dashboard" : "/register-salon", { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed";
      console.error("Owner login error:", error);
      if (message.includes("public.owners") || message.includes("PGRST205")) {
        toast.error("Owners table missing in Supabase public schema. Apply migration 0009_fix_owners_schema_cache.sql.");
      }
      toast.error(message);
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

          <TurnstileCaptcha key={captchaResetKey} onTokenChange={setCaptchaToken} className="min-h-[78px]" />

          <Button type="submit" disabled={loading || !captchaToken} className="h-11 w-full rounded-xl">
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

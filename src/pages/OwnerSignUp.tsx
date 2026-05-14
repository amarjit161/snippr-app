import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Lock, Mail, Scissors } from "lucide-react";

export const OwnerSignUp = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { handleError } = useErrorHandler();

  const renderSteps = (active: 1 | 2 | 3) => (
    <div className="mb-6 flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground">
      <span className={`h-2.5 w-2.5 rounded-full ${active === 1 ? "bg-primary" : "bg-zinc-300"}`} />
      <span className={active === 1 ? "text-foreground" : ""}>Create Account</span>
      <span>→</span>
      <span className={`h-2.5 w-2.5 rounded-full ${active === 2 ? "bg-primary" : "bg-zinc-300"}`} />
      <span className={active === 2 ? "text-foreground" : ""}>Verify Email</span>
      <span>→</span>
      <span className={`h-2.5 w-2.5 rounded-full ${active === 3 ? "bg-primary" : "bg-zinc-300"}`} />
      <span className={active === 3 ? "text-foreground" : ""}>Setup Salon</span>
    </div>
  );

  const validatePassword = () => {
    if (password.length < 8) {
      return "Password must be at least 8 characters";
    }
    if (password !== confirmPassword) {
      return "Passwords do not match";
    }
    return null;
  };

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();

    const passwordError = validatePassword();
    if (passwordError) {
      toast.error(passwordError);
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding&flow=signup`,
        data: { role: "owner" },
      },
    });

    if (error) {
      console.error("SIGNUP_ERROR:", error.message, error.status);

      if (error.message.includes("already registered")) {
        toast.error("This email is already registered. Please sign in instead.");
      } else if (error.message.includes("rate limit")) {
        toast.error("Too many attempts. Please wait 60 seconds and try again.");
      } else {
        toast.error("Signup failed: " + error.message);
      }

      handleError(error, "OWNER_SIGNUP");
      setLoading(false);
      return;
    }

    console.log("SIGNUP_SUCCESS: Verification email sent to", email);
    setEmailSent(true);
    setLoading(false);
  };

  if (emailSent) {
    return (
      <div className="min-h-screen bg-background px-4 py-10">
        <div className="mx-auto max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          {renderSteps(2)}

          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
              <Scissors className="h-7 w-7" />
            </div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Step 2 of 3</p>
            <h1 className="mt-1 font-display text-2xl font-bold">Check your email</h1>
            <p className="mt-1 text-sm text-muted-foreground">We sent a verification link to</p>
            <p className="mt-1 font-semibold text-primary">{email}</p>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Click the link in the email to verify your account and continue setting up your salon.
          </p>

          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
            ⚠️ Check your spam folder if you don't see it within 2 minutes.
          </div>

          <button
            onClick={() => setEmailSent(false)}
            className="mt-4 w-full text-center text-sm text-muted-foreground underline"
          >
            Use a different email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        {renderSteps(1)}

        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-green-600">
            <Scissors className="h-6 w-6" />
          </div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Step 1 of 3</p>
          <h1 className="mt-1 font-display text-2xl font-bold">Create Owner Account</h1>
          <p className="mt-1 text-sm text-muted-foreground">Register your salon on Snippr</p>
        </div>

        <form onSubmit={handleSignUp} className="space-y-4">
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Owner email"
              className="pl-10"
            />
          </div>

          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              className="pl-10"
            />
          </div>

          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              className="pl-10"
            />
          </div>

          <p className="text-center text-xs text-muted-foreground">
            By registering, you agree to our Terms of Service and Privacy Policy.
          </p>

          <Button type="submit" disabled={loading} className="h-11 w-full rounded-xl">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Account & Verify Email"}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm">
          Already have an account?{" "}
          <Link to="/owner-login" className="font-medium text-primary hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
};

export default OwnerSignUp;

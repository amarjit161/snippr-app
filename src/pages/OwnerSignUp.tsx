import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { toast } from "sonner";
import { Loader2, Lock, Mail, Scissors } from "lucide-react";
import { V, VA, BG, DISP, BODY } from "@/components/landing/tokens";

const fieldStyle: React.CSSProperties = {
  padding: "12px 14px 12px 40px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.05)", color: "#fff", fontSize: 14, outline: "none",
  fontFamily: BODY, boxSizing: "border-box", width: "100%",
};

export const OwnerSignUp = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { handleError } = useErrorHandler();

  const renderSteps = (active: 1 | 2 | 3) => (
    <div className="mb-6 flex items-center justify-center gap-2 text-xs font-medium" style={{ color: "rgba(255,255,255,0.35)" }}>
      <span className="h-2 w-2 rounded-full" style={{ background: active === 1 ? V : "rgba(255,255,255,0.15)" }} />
      <span style={active === 1 ? { color: "#fff" } : undefined}>Create Account</span>
      <span>→</span>
      <span className="h-2 w-2 rounded-full" style={{ background: active === 2 ? V : "rgba(255,255,255,0.15)" }} />
      <span style={active === 2 ? { color: "#fff" } : undefined}>Verify Email</span>
      <span>→</span>
      <span className="h-2 w-2 rounded-full" style={{ background: active === 3 ? V : "rgba(255,255,255,0.15)" }} />
      <span style={active === 3 ? { color: "#fff" } : undefined}>Setup Salon</span>
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

  const pageStyle: React.CSSProperties = { minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: BODY, position: "relative", overflow: "hidden", padding: "40px 16px" };
  const cardStyle: React.CSSProperties = { width: "100%", maxWidth: 420, borderRadius: 24, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(24px)", padding: 28, position: "relative", zIndex: 10 };
  const glowBlob = (
    <div aria-hidden="true" style={{ position: "fixed", top: "8%", left: "8%", width: 420, height: 420, borderRadius: "50%",
      background: `radial-gradient(circle, ${V}12, transparent 70%)`, filter: "blur(60px)", pointerEvents: "none" }} />
  );

  if (emailSent) {
    return (
      <div style={pageStyle}>
        {glowBlob}
        <div style={cardStyle}>
          {renderSteps(2)}

          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl" style={{ background: `${V}1E`, color: VA }}>
              <Scissors className="h-7 w-7" />
            </div>
            <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.35)" }}>Step 2 of 3</p>
            <h1 style={{ fontFamily: DISP, fontSize: 24, fontWeight: 800, color: "#fff", marginTop: 4 }}>Check your email</h1>
            <p className="mt-1 text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>We sent a verification link to</p>
            <p className="mt-1 font-semibold" style={{ color: VA }}>{email}</p>
          </div>

          <p className="text-center text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
            Click the link in the email to verify your account and continue setting up your salon.
          </p>

          <div className="mt-4 rounded-xl p-4 text-sm" style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", color: "#FBBF24" }}>
            ⚠️ Check your spam folder if you don't see it within 2 minutes.
          </div>

          <button
            onClick={() => setEmailSent(false)}
            className="mt-4 w-full text-center text-sm underline"
            style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", fontFamily: BODY }}
          >
            Use a different email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      {glowBlob}
      <div style={cardStyle}>
        {renderSteps(1)}

        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: "rgba(16,185,129,0.12)", color: "#10B981" }}>
            <Scissors className="h-6 w-6" />
          </div>
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.35)" }}>Step 1 of 3</p>
          <h1 style={{ fontFamily: DISP, fontSize: 24, fontWeight: 800, color: "#fff", marginTop: 4 }}>Create Owner Account</h1>
          <p className="mt-1 text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Register your salon on Snippr</p>
        </div>

        <form onSubmit={handleSignUp} className="space-y-3.5">
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.35)" }} />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Owner email"
              style={fieldStyle}
            />
          </div>

          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.35)" }} />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              style={fieldStyle}
            />
          </div>

          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.35)" }} />
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              style={fieldStyle}
            />
          </div>

          <p className="text-center text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
            By registering, you agree to our Terms of Service and Privacy Policy.
          </p>

          <button type="submit" disabled={loading}
            style={{ width: "100%", padding: "13px 0", borderRadius: 12, background: loading ? `${V}80` : V, color: "#fff",
              fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", fontFamily: BODY, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Account & Verify Email"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
          Already have an account?{" "}
          <Link to="/owner-login" className="font-medium" style={{ color: VA }}>
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
};

export default OwnerSignUp;

import { FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Lock, Mail, Store, ChevronLeft } from "lucide-react";
import TurnstileCaptcha, { type TurnstileCaptchaHandle } from "@/components/TurnstileCaptcha";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { useAuth } from "@/contexts/AuthContext";
import gsap from "gsap";
import { V, VA, BG, DISP, BODY } from "@/components/landing/tokens";

type OwnerRecord = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  is_verified: boolean;
  is_active: boolean;
};

const fieldStyle: React.CSSProperties = {
  padding: '12px 14px 12px 40px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 14, outline: 'none',
  fontFamily: BODY, boxSizing: 'border-box', width: '100%',
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

  const readStoredOwner = () => {
    try {
      const raw = localStorage.getItem("owner");
      return raw ? (JSON.parse(raw) as OwnerRecord) : null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (!authLoading && user) {
      const storedOwner = readStoredOwner();
      const hasOwnerSession = Boolean(profile || storedOwner?.id === user.id);

      if (hasOwnerSession) {
        console.log("OWNER_LOGIN: User already authenticated with profile, redirecting to Dashboard");
        navigate("/owner-dashboard", { replace: true });
      } else if (!profileLoading && !profile && !storedOwner) {
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
        .select("id, email, name, phone, is_verified, is_active, created_at")
        .eq("id", authData.user!.id)
        .maybeSingle();

      if (profileError) {
        console.error("PROFILE_FETCH_ERROR:", profileError.message);
        throw profileError;
      }

      let finalOwnerProfile = ownerProfile as OwnerRecord | null;

      if (!ownerProfile) {
        console.log("PROFILE_NOT_FOUND - Creating auto-profile for returning user");

        // Auto-create basic owner record for users returning after password reset
        const { data: createdProfile, error: createError } = await supabase
          .from("owners")
          .insert({
            id: authData.user!.id,
            email: trimmedEmail,
            name: trimmedEmail.split("@")[0], // Use email prefix as default name
            is_verified: true,
            is_active: true,
          })
          .select("id, email, name, phone, is_verified, is_active, created_at")
          .maybeSingle();

        if (createError) {
          console.warn("AUTO_PROFILE_CREATE_FAILED:", createError.message);
          // If creation fails, don't block login - try to proceed anyway
          finalOwnerProfile = {
            id: authData.user!.id,
            email: trimmedEmail,
            name: trimmedEmail.split("@")[0]
          } as OwnerRecord;
        } else {
          finalOwnerProfile = createdProfile;
          console.log("AUTO_PROFILE_CREATED_SUCCESS");
        }
      }

      console.log("PROFILE_FETCH_SUCCESS", finalOwnerProfile.id);
      localStorage.setItem("owner", JSON.stringify(finalOwnerProfile));

      if (import.meta.env.DEV) console.log("SALON_FETCH_START");
      const { data: existingSalon } = await supabase
        .from("salons")
        .select("*")
        .eq("owner_id", finalOwnerProfile.id)
        .maybeSingle();

      if (import.meta.env.DEV) console.log("LOGIN_COMPLETE", { hasSalon: !!existingSalon });
      toast.success("Welcome back");

      // Store owner info in localStorage and set owner role so AuthContext knows
      localStorage.setItem("owner", JSON.stringify(finalOwnerProfile));
      localStorage.setItem("snippr_role", "owner");

      navigate(existingSalon ? "/owner-dashboard" : "/register-salon", { replace: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Login failed";
      if (import.meta.env.DEV) console.error("LOGIN_PIPELINE_ERROR:", message);
      toast.error(message);
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

      localStorage.setItem("snippr_reset_email", requestedEmail);
      setForgotSentTo(requestedEmail);
      toast.success("Password reset link sent to your email.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleForgotPasswordOpen = () => {
    navigate('/forgot-password');
  };

  const handleBackToLogin = () => {
    setIsForgotMode(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: BODY, position: "relative", overflow: "hidden", padding: "40px 16px" }}>
      <div aria-hidden="true" style={{ position: "absolute", top: "15%", left: "10%", width: 420, height: 420, borderRadius: "50%",
        background: `radial-gradient(circle, ${V}12, transparent 70%)`, filter: "blur(60px)", pointerEvents: "none" }} />

      <div ref={loginCardRef} style={{ width: "100%", maxWidth: 420, perspective: 1200, position: "relative", zIndex: 10 }}>
        <button onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
          cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: 13, marginBottom: 20, padding: 0, fontFamily: BODY }}>
          <ChevronLeft style={{ width: 14, height: 14 }} /> Back to website
        </button>

        <div
          ref={flipInnerRef}
          style={{ position: "relative", minHeight: 560, transformStyle: "preserve-3d", transform: "rotateY(0deg)" }}
        >
          {/* Front — login */}
          <div style={{ position: "absolute", inset: 0, borderRadius: 24, background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(24px)", padding: 28, backfaceVisibility: "hidden" }}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ margin: "0 auto 14px", width: 48, height: 48, borderRadius: 14, background: `${V}22`, border: `1px solid ${V}40`,
                display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Store style={{ width: 22, height: 22, color: V }} />
              </div>
              <h1 style={{ fontFamily: DISP, fontSize: 24, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>Owner Login</h1>
              <p style={{ marginTop: 4, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Sign in to manage your salon account.</p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ position: "relative" }}>
                <Mail style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: "rgba(255,255,255,0.35)" }} />
                <input type="email" placeholder="Owner email" value={email} onChange={(e) => setEmail(e.target.value)} required style={fieldStyle} />
              </div>

              <div style={{ position: "relative" }}>
                <Lock style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: "rgba(255,255,255,0.35)" }} />
                <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required style={fieldStyle} />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={handleForgotPasswordOpen}
                  disabled={forgotLoading}
                  style={{ fontSize: 12, fontWeight: 500, color: VA, background: "none", border: "none", cursor: "pointer", padding: 0, opacity: forgotLoading ? 0.6 : 1 }}
                >
                  Forgot password?
                </button>
              </div>

              {forgotSentTo && (
                <div style={{ borderRadius: 10, padding: "10px 12px", fontSize: 12, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", color: "#6EE7B7" }}>
                  Reset link sent to <strong>{forgotSentTo}</strong>. Open the email, click the link, set new password, then return to owner login.
                </div>
              )}

              <TurnstileCaptcha ref={turnstileRef} onTokenChange={setCaptchaToken} theme="dark" className="min-h-[78px]" />

              <button type="submit" disabled={loading || verifyingCaptcha || !captchaToken}
                style={{ width: "100%", padding: "13px 0", borderRadius: 12, background: (loading || verifyingCaptcha || !captchaToken) ? `${V}80` : V,
                  color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", fontFamily: BODY,
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Login"}
              </button>
            </form>

            <p style={{ marginTop: 16, textAlign: "center", fontSize: 13, color: "rgba(255,255,255,0.35)" }}>
              New salon owner?{" "}
              <button onClick={() => navigate("/owner-signup")} style={{ color: VA, fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                Create Account
              </button>
            </p>
          </div>

          {/* Back — reset password */}
          <div style={{ position: "absolute", inset: 0, borderRadius: 24, background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(24px)", padding: 28,
            backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ margin: "0 auto 14px", width: 48, height: 48, borderRadius: 14, background: `${VA}22`, border: `1px solid ${VA}40`,
                display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Lock style={{ width: 22, height: 22, color: VA }} />
              </div>
              <h1 style={{ fontFamily: DISP, fontSize: 24, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>Reset Password</h1>
              <p style={{ marginTop: 4, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Enter owner email to receive reset link.</p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ position: "relative" }}>
                <Mail style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: "rgba(255,255,255,0.35)" }} />
                <input type="email" placeholder="Owner email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} style={fieldStyle} />
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={handleBackToLogin} disabled={forgotLoading}
                  style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)",
                    background: "transparent", color: "rgba(255,255,255,0.7)", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: BODY }}>
                  Back to login
                </button>
                <button type="button" onClick={handleForgotPasswordSend} disabled={forgotLoading}
                  style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: "none", background: V, color: "#fff",
                    fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: BODY, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {forgotLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send link"}
                </button>
              </div>

              {forgotSentTo && (
                <div style={{ borderRadius: 10, padding: "10px 12px", fontSize: 12, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", color: "#6EE7B7" }}>
                  Reset link sent to <strong>{forgotSentTo}</strong>.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

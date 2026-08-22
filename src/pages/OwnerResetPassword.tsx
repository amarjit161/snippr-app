import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, CheckCircle2, Loader2, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { V, VA, BG, DISP, BODY } from "@/components/landing/tokens";

type Status = "loading" | "ready" | "success" | "error";

const fieldStyle: React.CSSProperties = {
  padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.05)", color: "#fff", fontSize: 14, outline: "none",
  fontFamily: BODY, boxSizing: "border-box", width: "100%",
};

const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase",
  color: "rgba(255,255,255,0.4)", marginBottom: 6, display: "block",
};

const btnStyle: React.CSSProperties = {
  width: "100%", padding: "13px 0", borderRadius: 12, color: "#fff", fontWeight: 700, fontSize: 14,
  border: "none", fontFamily: BODY, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
};

export default function OwnerResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<Status>("loading");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [email, setEmail] = useState("");
  const [emailLocked, setEmailLocked] = useState(false);
  const [codeRequired, setCodeRequired] = useState(false);
  const [minOtpLength] = useState(6);
  const [maxOtpLength] = useState(10);

  useEffect(() => {
    const rememberedEmail = localStorage.getItem("snippr_reset_email");
    const emailFromQuery = searchParams.get("email")?.trim().toLowerCase() || "";

    if (/^\S+@\S+\.\S+$/.test(emailFromQuery)) {
      setEmail(emailFromQuery);
      setEmailLocked(true);
      localStorage.setItem("snippr_reset_email", emailFromQuery);
    } else if (rememberedEmail) {
      setEmail(rememberedEmail);
    }

    const initRecoverySession = async () => {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const searchParams = new URLSearchParams(window.location.search);
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const hashType = hashParams.get("type");
      const queryType = searchParams.get("type");
      const tokenHash = searchParams.get("token_hash");
      const code = searchParams.get("code");

      // Legacy hash-based recovery link
      if (hashType === "recovery" && accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          setErrorMessage(error.message || "Recovery link is invalid or expired.");
          setStatus("error");
          return;
        }

        setStatus("ready");
        return;
      }

      // New token_hash recovery link format - try it first
      if (queryType === "recovery" && tokenHash) {
        const { error } = await supabase.auth.verifyOtp({
          type: "recovery",
          token_hash: tokenHash,
        });

        if (!error) {
          setStatus("ready");
          return;
        }
        
        // Token expired or invalid - ask user to enter code manually
        // The code is still in the email, user just needs to copy-paste it
        console.warn("Token hash verification failed, switching to manual code entry");
        setCodeRequired(true);
        setStatus("ready");
        return;
      }

      // PKCE code flow fallback
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setErrorMessage(error.message || "Recovery link is invalid or expired.");
          setStatus("error");
          return;
        }

        setStatus("ready");
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        setStatus("ready");
        return;
      }

      // No active session and no recovery link - show manual code entry option
      setCodeRequired(true);
      setStatus("ready");
    };

    initRecoverySession();
  }, [searchParams]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;

    // If code is required, verify code and email first.
    // Do not continue to password update until OTP verification succeeds.
    if (codeRequired) {
      if (!email) {
        toast.error("Please enter your email address.");
        return;
      }

      const normalizedCode = verificationCode.trim();
      if (
        normalizedCode.length < minOtpLength ||
        normalizedCode.length > maxOtpLength ||
        !/^\d+$/.test(normalizedCode)
      ) {
        toast.error(`Please enter a valid ${minOtpLength}-${maxOtpLength} digit code.`);
        return;
      }

      setSaving(true);
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: normalizedCode,
        type: "recovery",
      });

      if (error) {
        toast.error(error.message || "Invalid verification code.");
        setSaving(false);
        return;
      }

      // Code verified! Clear it so form can proceed to password reset
      setVerificationCode("");
      setCodeRequired(false);
      setSaving(false);
      return;
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      toast.error(error.message || "Unable to update password.");
      setSaving(false);
      return;
    }

    setStatus("success");
    toast.success("Password updated successfully.");

    setTimeout(() => {
      navigate("/owner-login", { replace: true });
    }, 1500);
  };

  return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: BODY, position: "relative", overflow: "hidden", padding: "40px 16px" }}>
      <div aria-hidden="true" style={{ position: "fixed", top: "12%", right: "8%", width: 400, height: 400, borderRadius: "50%",
        background: `radial-gradient(circle, ${V}12, transparent 70%)`, filter: "blur(60px)", pointerEvents: "none" }} />

      <div style={{ width: "100%", maxWidth: 400, borderRadius: 24, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
        padding: 28, backdropFilter: "blur(20px)", position: "relative", zIndex: 10 }}>
        {status === "loading" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ margin: "0 auto 14px", width: 48, height: 48, borderRadius: 14, background: `${V}22`, border: `1px solid ${V}40`,
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Loader2 className="h-6 w-6 animate-spin" style={{ color: V }} />
            </div>
            <h1 style={{ fontFamily: DISP, fontSize: 24, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>Preparing reset</h1>
            <p style={{ marginTop: 6, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Please wait while we validate your recovery link.</p>
          </div>
        )}

        {status === "ready" && (
          <>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ margin: "0 auto 14px", width: 48, height: 48, borderRadius: 14, background: `${VA}22`, border: `1px solid ${VA}40`,
                display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Lock style={{ width: 22, height: 22, color: VA }} />
              </div>
              <h1 style={{ fontFamily: DISP, fontSize: 24, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>
                {codeRequired ? "Verify your email" : "Set new password"}
              </h1>
              <p style={{ marginTop: 4, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
                {codeRequired
                  ? "Enter the OTP code from your reset email"
                  : "Choose a strong password for your owner account."}
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {codeRequired && (
                <>
                  <div>
                    <label style={labelStyle}>Email Address</label>
                    <div style={{ position: "relative" }}>
                      <Mail style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: "rgba(255,255,255,0.35)" }} />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your-email@example.com"
                        readOnly={emailLocked}
                        required
                        style={{ ...fieldStyle, paddingLeft: 40, opacity: emailLocked ? 0.6 : 1 }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>OTP Code</label>
                    <input
                      type="text"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, maxOtpLength))}
                      placeholder="Enter OTP"
                      maxLength={maxOtpLength}
                      required
                      style={{ ...fieldStyle, textAlign: "center", fontSize: 18, fontWeight: 700, letterSpacing: "0.25em" }}
                    />
                    <p style={{ marginTop: 8, fontSize: 11, color: "rgba(255,255,255,0.3)", textAlign: "center" }}>Enter the OTP from your email</p>
                  </div>

                  <button
                    type="submit"
                    disabled={
                      saving ||
                      verificationCode.trim().length < minOtpLength ||
                      verificationCode.trim().length > maxOtpLength
                    }
                    style={{
                      ...btnStyle,
                      background: (saving || verificationCode.trim().length < minOtpLength || verificationCode.trim().length > maxOtpLength) ? `${V}80` : V,
                      cursor: (saving || verificationCode.trim().length < minOtpLength || verificationCode.trim().length > maxOtpLength) ? "not-allowed" : "pointer",
                    }}
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify Code"}
                  </button>
                </>
              )}

              {!codeRequired && (
                <>
                  <div>
                    <label style={labelStyle}>New Password</label>
                    <div style={{ position: "relative" }}>
                      <Lock style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: "rgba(255,255,255,0.35)" }} />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="New password"
                        required
                        style={{ ...fieldStyle, paddingLeft: 40 }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Confirm Password</label>
                    <div style={{ position: "relative" }}>
                      <Lock style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: "rgba(255,255,255,0.35)" }} />
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        required
                        style={{ ...fieldStyle, paddingLeft: 40 }}
                      />
                    </div>
                  </div>

                  <button type="submit" disabled={saving} style={{ ...btnStyle, background: saving ? `${V}80` : V, cursor: saving ? "not-allowed" : "pointer" }}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Password"}
                  </button>
                </>
              )}
            </form>
          </>
        )}

        {status === "success" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ margin: "0 auto 14px", width: 48, height: 48, borderRadius: 14, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CheckCircle2 style={{ width: 22, height: 22, color: "#10B981" }} />
            </div>
            <h1 style={{ fontFamily: DISP, fontSize: 24, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>Password updated</h1>
            <p style={{ marginTop: 6, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Redirecting to owner login.</p>
          </div>
        )}

        {status === "error" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ margin: "0 auto 14px", width: 48, height: 48, borderRadius: 14, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              <AlertCircle style={{ width: 22, height: 22, color: "#EF4444" }} />
            </div>
            <h1 style={{ fontFamily: DISP, fontSize: 24, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>Reset link invalid</h1>
            <p style={{ marginTop: 6, marginBottom: 20, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>{errorMessage}</p>
            <button onClick={() => navigate("/owner-login")} style={{ ...btnStyle, background: V, cursor: "pointer" }}>Back to owner login</button>
          </div>
        )}
      </div>
    </div>
  );
}


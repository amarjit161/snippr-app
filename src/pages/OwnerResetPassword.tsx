import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, CheckCircle2, Loader2, Lock, Mail } from "lucide-react";
import { toast } from "sonner";

type Status = "loading" | "ready" | "success" | "error";

export default function OwnerResetPassword() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("loading");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [email, setEmail] = useState("");
  const [codeRequired, setCodeRequired] = useState(false);
  const [minOtpLength] = useState(6);
  const [maxOtpLength] = useState(10);

  useEffect(() => {
    const rememberedEmail = localStorage.getItem("snippr_reset_email");
    if (rememberedEmail) {
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
  }, []);

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
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        {status === "loading" && (
          <div className="space-y-3 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
            <h1 className="font-display text-2xl font-bold">Preparing reset</h1>
            <p className="text-sm text-muted-foreground">Please wait while we validate your recovery link.</p>
          </div>
        )}

        {status === "ready" && (
          <>
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-green-600">
                <Lock className="h-6 w-6" />
              </div>
              <h1 className="font-display text-2xl font-bold">
                {codeRequired ? "Verify your email" : "Set new password"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {codeRequired
                  ? "Enter the OTP code from your reset email"
                  : "Choose a strong password for your owner account."}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {codeRequired && (
                <>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your-email@example.com"
                      className="pl-10"
                      required
                    />
                  </div>

                  <div className="relative">
                    <Input
                      type="text"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, maxOtpLength))}
                      placeholder="Enter OTP"
                      maxLength={maxOtpLength}
                      className="text-center font-mono text-lg tracking-widest"
                      required
                    />
                    <p className="mt-1 text-xs text-muted-foreground">Enter the OTP from your email</p>
                  </div>

                  <Button
                    type="submit"
                    disabled={
                      saving ||
                      verificationCode.trim().length < minOtpLength ||
                      verificationCode.trim().length > maxOtpLength
                    }
                    className="h-11 w-full rounded-xl"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify Code"}
                  </Button>
                </>
              )}

              {!codeRequired && (
                <>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="New password"
                      className="pl-10"
                      required
                    />
                  </div>

                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="pl-10"
                      required
                    />
                  </div>

                  <Button type="submit" disabled={saving} className="h-11 w-full rounded-xl">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Password"}
                  </Button>
                </>
              )}
            </form>
          </>
        )}

        {status === "success" && (
          <div className="space-y-3 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-green-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h1 className="font-display text-2xl font-bold">Password updated</h1>
            <p className="text-sm text-muted-foreground">Redirecting to owner login.</p>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h1 className="font-display text-2xl font-bold">Reset link invalid</h1>
            <p className="text-sm text-muted-foreground">{errorMessage}</p>
            <Button className="h-11 w-full rounded-xl" onClick={() => navigate("/owner-login")}>Back to owner login</Button>
          </div>
        )}
      </div>
    </div>
  );
}

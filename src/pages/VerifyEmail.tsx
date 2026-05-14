import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const VerifyEmail = () => {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState(0);
  const navigate = useNavigate();

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

  useEffect(() => {
    let redirectTimer: ReturnType<typeof setTimeout> | null = null;

    const goToRegistration = () => {
      if (redirectTimer) {
        clearTimeout(redirectTimer);
      }

      setStatus("success");
      setProgress(100);
      redirectTimer = setTimeout(() => {
        navigate("/owner-register", { replace: true });
      }, 2000);
    };

    const handleVerification = async () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const type = hashParams.get("type");

      console.log("VERIFY_EMAIL: URL params", { type, hasToken: !!accessToken });

      if (accessToken && type === "signup") {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || "",
        });

        if (error) {
          console.error("VERIFY_ERROR:", error.message);
          setStatus("error");
          setMessage("Verification failed: " + error.message);
          return;
        }

        goToRegistration();
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email_confirmed_at) {
        goToRegistration();
        return;
      }

      setStatus("error");
      setMessage("Verification link expired or invalid. Please sign up again.");
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session) {
        goToRegistration();
      }

      if (event === "USER_UPDATED") {
        goToRegistration();
      }
    });

    handleVerification();

    return () => {
      subscription.unsubscribe();
      if (redirectTimer) clearTimeout(redirectTimer);
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-sm text-center">
        {renderSteps(2)}

        {status === "loading" && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Step 2 of 3</p>
            <h2 className="mt-1 font-display text-2xl font-bold">Verifying your email...</h2>
            <p className="mt-1 text-sm text-muted-foreground">Please wait while we confirm your account.</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-green-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Step 2 of 3</p>
            <h2 className="mt-1 font-display text-2xl font-bold">You're in! Setting up your salon...</h2>
            <p className="mt-1 text-sm text-muted-foreground">Email verified successfully. Redirecting now.</p>
            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-1.5 rounded-full bg-primary"
                style={{ width: `${progress}%`, transition: "width 2s linear" }}
              />
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <AlertCircle className="h-6 w-6" />
            </div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Step 2 of 3</p>
            <h2 className="mt-1 font-display text-2xl font-bold">Verification Failed</h2>
            <p className="mt-1 text-sm text-muted-foreground">{message}</p>
            <Button
              className="mt-6 h-11 w-full rounded-xl"
              onClick={() => navigate("/owner-signup")}
            >
              Try Again
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { V, VA, BG, DISP, BODY } from "@/components/landing/tokens";

export const VerifyEmail = () => {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState(0);
  const navigate = useNavigate();

  const renderSteps = (active: 1 | 2 | 3) => (
    <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.35)' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: active === 1 ? V : 'rgba(255,255,255,0.15)' }} />
      <span style={{ color: active === 1 ? '#fff' : 'rgba(255,255,255,0.35)' }}>Create Account</span>
      <span>→</span>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: active === 2 ? V : 'rgba(255,255,255,0.15)' }} />
      <span style={{ color: active === 2 ? '#fff' : 'rgba(255,255,255,0.35)' }}>Verify Email</span>
      <span>→</span>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: active === 3 ? V : 'rgba(255,255,255,0.15)' }} />
      <span style={{ color: active === 3 ? '#fff' : 'rgba(255,255,255,0.35)' }}>Setup Salon</span>
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
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: BODY, position: 'relative', overflow: 'hidden' }}>
      <div aria-hidden="true" style={{ position: 'fixed', top: '10%', right: '5%', width: 400, height: 400, borderRadius: '50%',
        background: `radial-gradient(circle, ${V}12, transparent 70%)`, filter: 'blur(60px)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 440, position: 'relative', zIndex: 10 }}>
        <div style={{ borderRadius: 24, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: 28, backdropFilter: 'blur(20px)', textAlign: 'center' }}>
          {renderSteps(2)}

          {status === "loading" && (
            <>
              <div style={{ margin: '0 auto 16px', display: 'flex', height: 48, width: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, background: `${V}1F`, color: VA }}>
                <Loader2 className="animate-spin" style={{ width: 24, height: 24 }} />
              </div>
              <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>Step 2 of 3</p>
              <h2 style={{ fontFamily: DISP, fontSize: 24, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', marginTop: 6 }}>Verifying your email...</h2>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 6 }}>Please wait while we confirm your account.</p>
            </>
          )}

          {status === "success" && (
            <>
              <div style={{ margin: '0 auto 16px', display: 'flex', height: 48, width: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, background: 'rgba(16,185,129,0.12)', color: '#10B981' }}>
                <CheckCircle2 style={{ width: 24, height: 24 }} />
              </div>
              <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>Step 2 of 3</p>
              <h2 style={{ fontFamily: DISP, fontSize: 24, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', marginTop: 6 }}>You're in! Setting up your salon...</h2>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 6 }}>Email verified successfully. Redirecting now.</p>
              <div style={{ marginTop: 16, height: 6, width: '100%', overflow: 'hidden', borderRadius: 99, background: 'rgba(255,255,255,0.07)' }}>
                <div
                  style={{ height: '100%', borderRadius: 99, background: `linear-gradient(90deg, ${V}, ${VA})`, width: `${progress}%`, transition: 'width 2s linear' }}
                />
              </div>
            </>
          )}

          {status === "error" && (
            <>
              <div style={{ margin: '0 auto 16px', display: 'flex', height: 48, width: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, background: 'rgba(239,68,68,0.12)', color: '#EF4444' }}>
                <AlertCircle style={{ width: 24, height: 24 }} />
              </div>
              <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>Step 2 of 3</p>
              <h2 style={{ fontFamily: DISP, fontSize: 24, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', marginTop: 6 }}>Verification Failed</h2>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 6 }}>{message}</p>
              <button
                onClick={() => navigate("/owner-signup")}
                style={{ width: '100%', padding: '13px 0', borderRadius: 12, background: V, color: '#fff',
                  fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer', marginTop: 20, fontFamily: BODY }}>
                Try Again
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;

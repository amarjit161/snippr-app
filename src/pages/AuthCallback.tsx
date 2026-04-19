import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type CallbackStatus = "loading" | "error";

const SUPPORTED_VERIFY_TYPES = new Set(["signup", "recovery", "magiclink", "invite", "email"]);

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<CallbackStatus>("loading");
  const [message, setMessage] = useState("Finalizing sign-in...");

  useEffect(() => {
    const run = async () => {
      try {
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));

        // Check for Supabase auth errors first
        const error = hashParams.get("error");
        const errorCode = hashParams.get("error_code");
        const errorDescription = hashParams.get("error_description");

        if (error || errorCode) {
          const message = errorDescription
            ? decodeURIComponent(errorDescription).replace(/\+/g, " ")
            : `Authentication failed: ${error || errorCode}`;
          throw new Error(message);
        }

        const hashType = hashParams.get("type");
        const queryType = searchParams.get("type");
        const flowType = (hashType || queryType || searchParams.get("flow") || "").toLowerCase();

        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const tokenHash = searchParams.get("token_hash");
        const code = searchParams.get("code");

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            throw error;
          }
        } else if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            throw error;
          }
        } else if (tokenHash && SUPPORTED_VERIFY_TYPES.has(flowType)) {
          const { error } = await supabase.auth.verifyOtp({
            type: flowType as any,
            token_hash: tokenHash,
          });

          if (error) {
            throw error;
          }
        }

        if (flowType === "recovery") {
          navigate("/reset-password", { replace: true });
          return;
        }

        const explicitNext = searchParams.get("next");
        if (explicitNext) {
          navigate(explicitNext, { replace: true });
          return;
        }

        if (flowType === "signup") {
          navigate("/verify-email", { replace: true });
          return;
        }

        // Check profile completion for logged-in users
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('customer_profiles')
            .select('phone, gender')
            .eq('id', user.id)
            .maybeSingle();

          // Redirect to profile completion if incomplete
          if (!profile?.phone || !profile?.gender) {
            navigate("/profile-completion", { replace: true });
            return;
          }
        }

        navigate("/auth", { replace: true });
      } catch (error: any) {
        console.error("AUTH_CALLBACK_ERROR", error);
        setMessage(error?.message || "Authentication link is invalid or expired.");
        setStatus("error");
      }
    };

    run();
  }, [navigate, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        {status === "loading" ? (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
            <h1 className="font-display text-2xl font-bold">Processing authentication</h1>
            <p className="mt-2 text-sm text-muted-foreground">{message}</p>
          </>
        ) : (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h1 className="font-display text-2xl font-bold">Link invalid</h1>
            <p className="mt-2 text-sm text-muted-foreground">{message}</p>
            <Button className="mt-6 h-11 w-full rounded-xl" onClick={() => navigate("/auth", { replace: true })}>
              Go to login
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

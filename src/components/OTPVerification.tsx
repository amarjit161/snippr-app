import { useEffect, useMemo, useRef, useState } from "react";
import type { ClipboardEvent, KeyboardEvent } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;

const OTPVerification = () => {
  const navigate = useNavigate();
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const [phone, setPhone] = useState("");
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    const savedPhone = localStorage.getItem("snippr_auth_phone") || "";
    setPhone(savedPhone);
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [countdown]);

  const otpValue = useMemo(() => digits.join(""), [digits]);

  const setDigitAt = (idx: number, value: string) => {
    setDigits((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  };

  const handleChange = (idx: number, value: string) => {
    const sanitized = value.replace(/\D/g, "");

    if (!sanitized) {
      setDigitAt(idx, "");
      return;
    }

    const chars = sanitized.slice(0, OTP_LENGTH).split("");
    setDigits((prev) => {
      const next = [...prev];
      let cursor = idx;
      for (const char of chars) {
        if (cursor >= OTP_LENGTH) break;
        next[cursor] = char;
        cursor += 1;
      }
      return next;
    });

    const focusIndex = Math.min(idx + chars.length, OTP_LENGTH - 1);
    inputRefs.current[focusIndex]?.focus();
  };

  const handleKeyDown = (idx: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !digits[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }

    if (event.key === "ArrowLeft" && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }

    if (event.key === "ArrowRight" && idx < OTP_LENGTH - 1) {
      inputRefs.current[idx + 1]?.focus();
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;

    const next = Array(OTP_LENGTH).fill("");
    pasted.split("").forEach((digit, idx) => {
      next[idx] = digit;
    });

    setDigits(next);
    inputRefs.current[Math.min(pasted.length, OTP_LENGTH) - 1]?.focus();
  };

  const verifyOtp = async () => {
    if (!phone) {
      toast.error("Missing phone number. Please request OTP again.");
      navigate("/login");
      return;
    }

    if (otpValue.length !== OTP_LENGTH) {
      toast.error("Please enter all 6 digits");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      phone,
      token: otpValue,
      type: "sms",
    });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Phone verified. Welcome back!");
  };

  const resendOtp = async () => {
    if (!phone) {
      toast.error("Phone number not found. Please login again.");
      navigate("/login");
      return;
    }

    setResending(true);
    const { error } = await supabase.auth.signInWithOtp({ phone });
    setResending(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("OTP resent");
    setCountdown(RESEND_SECONDS);
  };

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-border bg-card/95 p-8 shadow-sm backdrop-blur-xl sm:p-10">
      <div className="mb-7 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 text-white shadow-sm">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">Verification Code</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Precision in every second. Enter the 6-digit code sent to {phone || "your phone"}
        </p>
      </div>

      <div className="flex justify-center gap-2 sm:gap-3">
        {digits.map((digit, idx) => (
          <input
            key={idx}
            ref={(el) => {
              inputRefs.current[idx] = el;
            }}
            value={digit}
            onChange={(event) => handleChange(idx, event.target.value)}
            onKeyDown={(event) => handleKeyDown(idx, event)}
            onPaste={handlePaste}
            inputMode="numeric"
            maxLength={1}
            className="h-12 w-10 rounded-xl border border-border bg-background text-center text-xl font-semibold text-foreground outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/20 sm:h-14 sm:w-12"
          />
        ))}
      </div>

      <Button
        onClick={verifyOtp}
        disabled={loading || otpValue.length !== OTP_LENGTH}
        className="mt-6 h-11 w-full rounded-xl bg-gradient-to-r from-primary to-indigo-500 text-primary-foreground hover:brightness-110"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Get Started"}
      </Button>

      <div className="mt-5 flex items-center justify-between text-sm">
        <button
          onClick={() => navigate("/login")}
          className="text-zinc-500 transition-colors hover:text-zinc-900"
        >
          Change phone
        </button>

        <button
          onClick={resendOtp}
          disabled={countdown > 0 || resending}
          className="font-medium text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {resending ? "Sending..." : countdown > 0 ? `Resend Code (${countdown}s)` : "Resend Code"}
        </button>
      </div>
    </div>
  );
};

export default OTPVerification;

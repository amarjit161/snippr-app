import { useState } from "react";
import { Phone, ArrowRight, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const OTPLogin = () => {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [loading, setLoading] = useState(false);

  const handleSendOTP = async () => {
    if (!phone || phone.length < 10) {
      toast.error("Please enter a valid phone number");
      return;
    }
    setLoading(true);
    
    // Demo Bypass: Instantly proceed to OTP step without pinging Supabase SMS
    setTimeout(() => {
       toast.success("OTP sent to your phone! (Demo: use 123456)");
       setStep("otp");
       setLoading(false);
    }, 600);
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      toast.error("Please enter a 6-digit OTP");
      return;
    }
    setLoading(true);

    if (otp === "123456") {
      const demoEmail = `demo_${phone.replace(/\D/g, "")}@snippr.in`;
      const { error: signUpError } = await supabase.auth.signUp({
        email: demoEmail,
        password: `demo_${phone}_secure_pwd_2024!`,
      });
      if (signUpError && signUpError.message.includes("already registered")) {
        await supabase.auth.signInWithPassword({
          email: demoEmail,
          password: `demo_${phone}_secure_pwd_2024!`,
        });
      } else if (signUpError) {
        toast.error("Login failed. Please try again.");
        setLoading(false);
        return;
      }
      toast.success("Welcome to Snippr! 🎉");
    } else {
      toast.error("Invalid OTP. Use 123456 for demo.");
    }
    
    setLoading(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="mx-auto max-w-sm space-y-6 rounded-lg bg-card p-8 shadow-elevation-3"
    >
      <div className="text-center space-y-2">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <Shield className="h-7 w-7 text-primary" />
        </div>
        <h2 className="font-display text-2xl font-bold text-card-foreground">
          {step === "phone" ? "Login to Snippr" : "Verify OTP"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {step === "phone"
            ? "Enter your phone number to get started"
            : `OTP sent to ${phone}`}
        </p>
      </div>

      <AnimatePresence mode="wait">
        {step === "phone" ? (
          <motion.div
            key="phone"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-4"
          >
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Enter phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="pl-10"
                type="tel"
                maxLength={15}
              />
            </div>
            <Button
              onClick={handleSendOTP}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading ? "Sending…" : "Send OTP"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="otp"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-4"
          >
            <Input
              placeholder="Enter 6-digit OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="text-center text-xl tracking-[0.5em] font-mono"
              maxLength={6}
            />
            <Button
              onClick={handleVerifyOTP}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading ? "Verifying…" : "Verify OTP"}
            </Button>
            <button
              onClick={() => setStep("phone")}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Change phone number
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default OTPLogin;

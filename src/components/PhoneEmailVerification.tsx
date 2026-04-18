import { useEffect, useRef, useState } from "react";
import { Phone, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface PhoneEmailVerificationProps {
  onSuccess?: (phoneData: any) => void;
  onError?: (error: string) => void;
}

export const PhoneEmailVerification = ({ onSuccess, onError }: PhoneEmailVerificationProps) => {
  const navigate = useNavigate();
  const [verificationStatus, setVerificationStatus] = useState<"idle" | "verifying" | "success" | "error">("idle");
  const [verifiedPhone, setVerifiedPhone] = useState("");
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load the external phone.email script
    const script = document.createElement("script");
    script.src = "https://www.phone.email/sign_in_button_v1.js";
    script.async = true;
    
    // Define the callback function
    (window as any).phoneEmailListener = function(userObj: any) {
      const user_json_url = userObj.user_json_url;
      
      // Insert the debug message
      console.log("Phone Verification Successful!");
      console.log("User JSON URL:", user_json_url);

      // Fetch authenticated country code and phone number from the backend
      fetchPhoneData(user_json_url);

      // Remove debug message after 3 seconds (optional)
      setTimeout(() => {
        const debugMsg = document.querySelector("[class*='Phone Verification Successful']");
        if (debugMsg) debugMsg.remove();
      }, 3000);
    };

    if (buttonRef.current) {
      buttonRef.current.appendChild(script);
    }

    return () => {
      if (buttonRef.current && script.parentNode === buttonRef.current) {
        buttonRef.current.removeChild(script);
      }
    };
  }, []);

  const fetchPhoneData = async (user_json_url: string) => {
    try {
      setVerificationStatus("verifying");
      
      // Call your backend to fetch authenticated phone data
      const response = await fetch("/api/verify-phone-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_json_url })
      });

      if (!response.ok) {
        throw new Error("Failed to verify phone");
      }

      const data = await response.json();
      
      if (data.phone_number) {
        setVerifiedPhone(data.phone_number);
        setVerificationStatus("success");
        toast.success(`Phone verified: ${data.phone_number}`);
        
        // Store phone and country code
        localStorage.setItem("snippr_verified_phone", data.phone_number);
        localStorage.setItem("snippr_country_code", data.country_code || "");
        
        onSuccess?.(data);
        
        // Redirect after 2 seconds
        setTimeout(() => {
          navigate("/dashboard");
        }, 2000);
      }
    } catch (error) {
      setVerificationStatus("error");
      const message = error instanceof Error ? error.message : "Phone verification failed";
      toast.error(message);
      onError?.(message);
      console.error("Phone verification error:", error);
    }
  };

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-border bg-card/95 p-8 shadow-sm backdrop-blur-xl sm:p-10">
      <div className="mb-7 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 text-white shadow-sm">
          <Phone className="h-6 w-6" />
        </div>
        <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">
          Verify Your Phone
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Click below to securely verify your phone number
        </p>
      </div>

      {verificationStatus === "success" && (
        <div className="mb-6 flex items-center gap-3 rounded-lg bg-green-50 dark:bg-green-950 p-4 border border-green-200 dark:border-green-800">
          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
          <div>
            <p className="font-medium text-green-900 dark:text-green-100">
              Phone verified successfully!
            </p>
            <p className="text-sm text-green-800 dark:text-green-200">
              {verifiedPhone}
            </p>
          </div>
        </div>
      )}

      {verificationStatus === "error" && (
        <div className="mb-6 flex items-center gap-3 rounded-lg bg-red-50 dark:bg-red-950 p-4 border border-red-200 dark:border-red-800">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
          <p className="text-sm font-medium text-red-900 dark:text-red-100">
            Verification failed. Please try again.
          </p>
        </div>
      )}

      {verificationStatus === "verifying" && (
        <div className="mb-6 flex items-center justify-center gap-2 p-4">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Verifying your phone...</p>
        </div>
      )}

      {/* Phone.email Sign-in Button Container */}
      <div 
        ref={buttonRef}
        className="flex justify-center mb-6 min-h-[70px]"
      >
        {/* Button will be inserted here by phone.email script */}
      </div>

      <div className="text-center text-xs text-muted-foreground">
        <p>Your phone number will be securely verified</p>
        <p className="mt-2">by phone.email</p>
      </div>
    </div>
  );
};

export default PhoneEmailVerification;

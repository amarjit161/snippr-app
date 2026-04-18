/**
 * Phone.email Integration Examples
 * 
 * Complete examples of how to integrate phone.email verification
 * into your Snippr app
 */

// ============================================================
// EXAMPLE 1: Add as standalone verification page
// ============================================================

// 1. Add route to your router:
import PhoneVerification from "@/pages/PhoneVerification";

const routes = [
  // ... existing routes
  {
    path: "/verify-phone",
    element: <PhoneVerification />
  }
];

// 2. Add link to verification page:
<Link to="/verify-phone" className="text-blue-600 hover:underline">
  Verify Phone Number
</Link>


// ============================================================
// EXAMPLE 2: Replace phone OTP in OTPLogin component
// ============================================================

// In: src/components/OTPLogin.tsx

import PhoneEmailVerification from "@/components/PhoneEmailVerification";

export const OTPLogin = () => {
  const [usePhoneEmail, setUsePhoneEmail] = useState(false);

  if (usePhoneEmail) {
    return (
      <div className="w-full max-w-[440px]">
        <PhoneEmailVerification 
          onSuccess={(data) => {
            toast.success(`Phone verified: ${data.phone_number}`);
            navigate("/dashboard");
          }}
          onError={(error) => {
            toast.error(error);
            setUsePhoneEmail(false);
          }}
        />
        <button
          onClick={() => setUsePhoneEmail(false)}
          className="mt-4 text-blue-600 hover:underline"
        >
          Back to email verification
        </button>
      </div>
    );
  }

  // ... existing email/phone OTP UI

  // Add button to switch to phone.email:
  <button
    onClick={() => setUsePhoneEmail(true)}
    className="mt-4 flex items-center gap-2 text-primary hover:underline"
  >
    <Phone className="h-4 w-4" />
    Use phone.email verification instead
  </button>
};


// ============================================================
// EXAMPLE 3: Side-by-side with existing verification
// ============================================================

// In: src/pages/Auth.tsx

import OTPLogin from "@/components/OTPLogin";
import PhoneEmailVerification from "@/components/PhoneEmailVerification";

export default function Auth() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-2xl grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Left: Email OTP */}
        <div>
          <h3 className="mb-4 text-lg font-bold">Quick Login</h3>
          <OTPLogin />
        </div>

        {/* Divider */}
        <div className="hidden md:flex items-center">
          <div className="w-full h-px bg-border"></div>
          <span className="px-2 text-muted-foreground text-xs">OR</span>
          <div className="w-full h-px bg-border"></div>
        </div>

        {/* Right: Phone.email */}
        <div>
          <h3 className="mb-4 text-lg font-bold">Phone Verification</h3>
          <PhoneEmailVerification 
            onSuccess={() => navigate("/dashboard")}
          />
        </div>
      </div>
    </div>
  );
}


// ============================================================
// EXAMPLE 4: Progressive Enhancement (Fallback)
// ============================================================

// In: src/components/PhoneVerificationWrapper.tsx

import PhoneEmailVerification from "@/components/PhoneEmailVerification";
import OTPVerification from "@/components/OTPVerification";
import { useState } from "react";

export const PhoneVerificationWrapper = () => {
  const [useFallback, setUseFallback] = useState(false);

  if (useFallback) {
    return (
      <div>
        <OTPVerification />
        <button
          onClick={() => setUseFallback(false)}
          className="mt-4 text-sm text-blue-600 hover:underline"
        >
          Try phone.email instead
        </button>
      </div>
    );
  }

  return (
    <div>
      <PhoneEmailVerification 
        onError={(error) => {
          console.warn("phone.email failed, falling back to OTP:", error);
          setUseFallback(true);
        }}
      />
    </div>
  );
};


// ============================================================
// EXAMPLE 5: Custom Callback Handler
// ============================================================

// In: src/hooks/usePhoneVerification.ts

import { useState, useCallback } from "react";
import { toast } from "sonner";

export const usePhoneVerification = () => {
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [isVerified, setIsVerified] = useState(false);

  const handleVerificationSuccess = useCallback((data: any) => {
    setPhone(data.phone_number);
    setCountryCode(data.country_code);
    setIsVerified(true);

    // Custom logic here:
    // - Update user profile
    // - Send to analytics
    // - Update auth state
    // etc.

    toast.success(`Phone verified: ${data.phone_number}`);
  }, []);

  const handleVerificationError = useCallback((error: string) => {
    setIsVerified(false);
    toast.error(error);
    
    // Custom error logic here:
    // - Log to Sentry
    // - Track in analytics
    // etc.
  }, []);

  return {
    phone,
    countryCode,
    isVerified,
    handleVerificationSuccess,
    handleVerificationError
  };
};

// Usage:
// const verification = usePhoneVerification();
// <PhoneEmailVerification onSuccess={verification.handleVerificationSuccess} />


// ============================================================
// EXAMPLE 6: Verify and Update User Profile
// ============================================================

// In: src/components/PhoneEmailVerification.tsx (enhancement)

const handlePhoneVerificationSuccess = async (data: any) => {
  try {
    // 1. Verify phone
    setVerificationStatus("verifying");
    
    // 2. Update user profile in Supabase
    const { error: updateError } = await supabase
      .from("users")
      .update({
        verified_phone: data.phone_number,
        phone_country_code: data.country_code,
        verified_phone_at: new Date().toISOString()
      })
      .eq("id", user.id);

    if (updateError) throw updateError;

    // 3. Create notification
    await createNotification({
      type: "phone_verified",
      title: "Phone Verified",
      message: `Your phone number ${data.phone_number} has been verified`
    });

    // 4. Success
    setVerificationStatus("success");
    setVerifiedPhone(data.phone_number);
    onSuccess?.(data);
  } catch (error) {
    setVerificationStatus("error");
    onError?.(error.message);
  }
};


// ============================================================
// EXAMPLE 7: Environment-based Verification Method
// ============================================================

// In: src/components/PhoneVerificationRouter.tsx

interface PhoneVerificationRouterProps {
  preferredMethod?: "otp" | "phone-email" | "auto";
}

export const PhoneVerificationRouter = ({
  preferredMethod = "auto"
}: PhoneVerificationRouterProps) => {
  const usePhoneEmail = 
    import.meta.env.VITE_PHONE_EMAIL_ENABLED === "true" &&
    (preferredMethod === "phone-email" || preferredMethod === "auto");

  if (usePhoneEmail) {
    return <PhoneEmailVerification />;
  } else {
    return <OTPVerification />;
  }
};

// Usage:
// <PhoneVerificationRouter preferredMethod="phone-email" />


// ============================================================
// EXAMPLE 8: Form Integration
// ============================================================

// In: src/pages/UserProfile.tsx

import PhoneEmailVerification from "@/components/PhoneEmailVerification";
import { useForm } from "react-hook-form";

export default function UserProfile() {
  const { watch } = useForm();
  const [showPhoneVerification, setShowPhoneVerification] = useState(false);

  if (showPhoneVerification) {
    return (
      <PhoneEmailVerification 
        onSuccess={(data) => {
          // Update form with verified phone
          form.setValue("phone", data.phone_number);
          setShowPhoneVerification(false);
        }}
      />
    );
  }

  return (
    <form>
      {/* Other form fields */}
      
      <button
        type="button"
        onClick={() => setShowPhoneVerification(true)}
      >
        Verify Phone Number
      </button>

      {/* Display verified phone if exists */}
      {watch("phone") && (
        <p className="text-green-600">
          ✓ Phone verified: {watch("phone")}
        </p>
      )}
    </form>
  );
}


// ============================================================
// EXAMPLE 9: Modal Integration
// ============================================================

// In: src/components/PhoneVerificationModal.tsx

import PhoneEmailVerification from "@/components/PhoneEmailVerification";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PhoneVerificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (data: any) => void;
}

export function PhoneVerificationModal({
  open,
  onOpenChange,
  onSuccess
}: PhoneVerificationModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Verify Your Phone</DialogTitle>
          <DialogDescription>
            Securely verify your phone number using phone.email
          </DialogDescription>
        </DialogHeader>
        
        <PhoneEmailVerification 
          onSuccess={(data) => {
            onSuccess?.(data);
            onOpenChange(false);
          }}
          onError={() => {
            // Keep modal open on error
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

// Usage:
// const [open, setOpen] = useState(false);
// <PhoneVerificationModal 
//   open={open} 
//   onOpenChange={setOpen}
//   onSuccess={handlePhoneVerified}
// />


// ============================================================
// EXAMPLE 10: Testing & Mocking
// ============================================================

// In: src/components/__tests__/PhoneEmailVerification.test.tsx

import { render, screen, waitFor } from "@testing-library/react";
import PhoneEmailVerification from "@/components/PhoneEmailVerification";

describe("PhoneEmailVerification", () => {
  it("should render verification component", () => {
    render(<PhoneEmailVerification />);
    expect(screen.getByText(/Verify Your Phone/i)).toBeInTheDocument();
  });

  it("should call onSuccess with verified phone", async () => {
    const onSuccess = jest.fn();
    render(<PhoneEmailVerification onSuccess={onSuccess} />);

    // Mock the phone.email script
    (window as any).phoneEmailListener({
      user_json_url: "https://phone.email/user/test"
    });

    // Mock the fetch response
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          phone_number: "+1234567890",
          country_code: "US"
        })
      })
    );

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          phone_number: "+1234567890"
        })
      );
    });
  });
});

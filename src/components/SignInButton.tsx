import React, { useEffect } from 'react';

const DEFAULT_CLIENT_ID = import.meta.env.VITE_PHONE_EMAIL_CLIENT_ID || "15695407177920574360";

/**
 * Simple phone.email Sign-in Button Component
 * 
 * This is the basic implementation from phone.email documentation.
 * For integration with backend verification, use PhoneEmailVerification instead.
 * 
 * Usage:
 * <SignInButton clientId="YOUR_CLIENT_ID" />
 */

interface SignInButtonProps {
  clientId?: string;
  onVerificationStart?: () => void;
}

const SignInButton: React.FC<SignInButtonProps> = ({
  clientId = DEFAULT_CLIENT_ID,
  onVerificationStart
}) => {
  useEffect(() => {
    const container = document.querySelector('.pe_signin_button');
    if (!container) return;

    // Load the external script
    const script = document.createElement('script');
    script.src = "https://www.phone.email/sign_in_button_v1.js";
    script.async = true;

    // Define the listener function BEFORE appending script
    (window as any).phoneEmailListener = function(userObj: any) {
      const user_json_url = userObj.user_json_url;
      
      // Notify parent component
      onVerificationStart?.();

      // Show debug message
      const debugMsg = document.createElement('div');
      debugMsg.style.cssText = `
        margin-top: 16px;
        padding: 12px;
        background-color: #f0fdf4;
        border: 1px solid #86efac;
        border-radius: 8px;
        font-size: 13px;
        color: #166534;
      `;
      debugMsg.innerHTML = `
        <strong>✓ Phone Verification Successful!</strong><br/>
        <br/>
        Send this URL to your backend:<br/>
        <code style="background: white; padding: 4px 8px; border-radius: 4px; word-break: break-all;">
          ${user_json_url}
        </code><br/>
        <br/>
        <small style="color: #9ca3af;">
          ✓ Step 1 Complete - Now implement Step 2 in your backend
        </small>
      `;
      container.appendChild(debugMsg);

      // Auto-remove after 10 seconds
      setTimeout(() => {
        debugMsg.remove();
      }, 10000);
    };

    // Append script to trigger button rendering
    container.appendChild(script);

    // Cleanup
    return () => {
      if (container && script.parentNode === container) {
        try {
          container.removeChild(script);
        } catch (e) {
          // Element already removed
        }
      }
    };
  }, [onVerificationStart]);

  return (
    <div 
      className="pe_signin_button" 
      data-client-id={clientId}
    />
  );
};

export default SignInButton;

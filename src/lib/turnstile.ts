export type TurnstileVerificationResponse = {
  success: boolean;
  message?: string;
};

export const verifyTurnstileToken = async (token: string) => {
  if (!token) {
    return { success: false, message: "Invalid or expired captcha" };
  }

  try {
    console.log("🔐 TURNSTILE_VERIFY_START");
    
    // Create abort controller with 10 second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch("/api/verify-turnstile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    console.log("🔐 TURNSTILE_VERIFY_RESPONSE", response.status);

    const data = (await response.json().catch(() => null)) as TurnstileVerificationResponse | null;

    if (!response.ok || !data?.success) {
      console.error("❌ TURNSTILE_VERIFY_FAILED", data?.message || "Unknown error");
      return {
        success: false,
        message: data?.message || "Captcha verification failed",
      };
    }

    console.log("✅ TURNSTILE_VERIFY_SUCCESS");
    return { success: true, message: undefined };
  } catch (error: any) {
    console.error("❌ TURNSTILE_VERIFY_ERROR", error?.message || error);
    
    if (error?.name === "AbortError") {
      return { success: false, message: "Captcha verification timeout - please try again" };
    }
    
    return { success: false, message: "Captcha verification failed" };
  }
};

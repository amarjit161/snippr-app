export type TurnstileVerificationResponse = {
  success: boolean;
  message?: string;
};

export const verifyTurnstileToken = async (token: string) => {
  if (!token) {
    return { success: false, message: "Invalid or expired captcha" };
  }

  try {
    const response = await fetch("/api/verify-turnstile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
    });

    const data = (await response.json().catch(() => null)) as TurnstileVerificationResponse | null;

    if (!response.ok || !data?.success) {
      return {
        success: false,
        message: data?.message || "Captcha verification failed",
      };
    }

    return { success: true, message: undefined };
  } catch (error) {
    console.error("Turnstile verification request failed", error);
    return { success: false, message: "Captcha verification failed" };
  }
};
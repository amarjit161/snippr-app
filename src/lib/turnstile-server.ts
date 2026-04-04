export type TurnstileCloudflareResponse = {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  "error-codes"?: string[];
  action?: string;
  cdata?: string;
};

export const verifyTurnstileWithCloudflare = async (
  token: string,
  secret: string,
  remoteIp?: string
): Promise<TurnstileCloudflareResponse> => {
  const payload: Record<string, string> = {
    secret,
    response: token,
  };

  if (remoteIp) payload.remoteip = remoteIp;

  const body = new URLSearchParams(payload);

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  return (await response.json()) as TurnstileCloudflareResponse;
};
import "dotenv/config";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import type { Plugin } from "vite";
import { config as loadDotenv } from "dotenv";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { verifyTurnstileWithCloudflare } from "./src/lib/turnstile-server";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  loadDotenv({ path: path.resolve(process.cwd(), ".env.local") });

  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;

  const turnstileDevApiPlugin: Plugin = {
    name: "snippr-turnstile-dev-api",
    configureServer(server) {
      server.middlewares.use("/api/verify-turnstile", async (req, res, next) => {
        if (req.method !== "POST") {
          next();
          return;
        }

        if (!turnstileSecret) {
          console.error("TURNSTILE_SECRET_KEY is missing in process.env (dev server)");
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: false, message: "Captcha verification unavailable" }));
          return;
        }

        const rawBody = await new Promise<string>((resolve) => {
          let body = "";
          req.on("data", (chunk) => {
            body += chunk.toString();
          });
          req.on("end", () => resolve(body));
        });

        let token = "";
        try {
          const parsed = rawBody ? JSON.parse(rawBody) : null;
          token = typeof parsed?.token === "string" ? parsed.token : "";
        } catch {
          token = "";
        }

        if (!token) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: false, message: "Invalid or expired captcha" }));
          return;
        }

        try {
          console.log(token);
          const result = await verifyTurnstileWithCloudflare(token, turnstileSecret);
          console.log(result);

          if (!result.success) {
            console.error("Cloudflare Turnstile verification failed (dev)", result);
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            const isExpiredOrInvalid = (result["error-codes"] || []).some((code) =>
              ["timeout-or-duplicate", "invalid-input-response", "missing-input-response"].includes(code)
            );

            res.end(JSON.stringify({
              success: false,
              message: isExpiredOrInvalid ? "Invalid or expired captcha" : "Captcha verification failed",
            }));
            return;
          }

          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: true }));
        } catch (error) {
          console.error("Dev Turnstile verification failed", error);
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: false, message: "Captcha verification failed" }));
        }
      });
    },
  };

  // Phone OTP API middleware for development
  const phoneOtpDevApiPlugin: Plugin = {
    name: "snippr-phone-otp-dev-api",
    configureServer(server) {
      const PHONE_EMAIL_CLIENT_ID = process.env.VITE_PHONE_EMAIL_CLIENT_ID;

      // Send phone OTP endpoint
      server.middlewares.use("/api/send-phone-otp", async (req, res, next) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        try {
          const rawBody = await new Promise<string>((resolve) => {
            let body = "";
            req.on("data", (chunk) => {
              body += chunk.toString();
            });
            req.on("end", () => resolve(body));
          });

          const { phone } = JSON.parse(rawBody || "{}");
          if (!phone) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: false, error: "Phone number is required" }));
            return;
          }

          const formatted = phone.startsWith("+") ? phone : `+91${phone.replace(/\D/g, "").slice(-10)}`;
          console.log(`[send-phone-otp] Sending OTP to ${formatted}`);

          const phoneResponse = await fetch(
            `https://auth.phone.email/send_otp?client_id=${PHONE_EMAIL_CLIENT_ID}&phone_number=${encodeURIComponent(formatted)}`,
            { method: "GET", headers: { Accept: "application/json" } }
          );

          // Check if response is ok before parsing JSON
          if (!phoneResponse.ok) {
            const text = await phoneResponse.text();
            console.error(`[send-phone-otp] HTTP Error:`, phoneResponse.status, text);
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: false, error: `Phone service error: ${phoneResponse.status}` }));
            return;
          }

          // Safely parse JSON
          let data;
          try {
            const responseText = await phoneResponse.text();
            if (!responseText || responseText.trim() === "") {
              console.warn(`[send-phone-otp] Empty response from phone service`);
              data = { status: "success" }; // Treat empty response as success
            } else {
              data = JSON.parse(responseText);
            }
          } catch (parseErr) {
            console.error(`[send-phone-otp] JSON Parse Error:`, parseErr, "Response text length:", responseText?.length);
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: false, error: "Invalid response from phone service" }));
            return;
          }

          console.log(`[send-phone-otp] Response:`, data);

          if (data.status === "success" || phoneResponse.ok) {
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: true, message: "OTP sent successfully" }));
          } else {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: false, error: data.message || "Failed to send OTP" }));
          }
        } catch (error: any) {
          console.error("[send-phone-otp] Error:", error);
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: false, error: error.message || "Internal server error" }));
        }
      });

      // Verify phone OTP endpoint
      server.middlewares.use("/api/verify-phone-otp", async (req, res, next) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        try {
          const rawBody = await new Promise<string>((resolve) => {
            let body = "";
            req.on("data", (chunk) => {
              body += chunk.toString();
            });
            req.on("end", () => resolve(body));
          });

          const { phone, otp } = JSON.parse(rawBody || "{}");
          if (!phone || !otp) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: false, error: "Phone number and OTP are required" }));
            return;
          }

          const formatted = phone.startsWith("+") ? phone : `+91${phone.replace(/\D/g, "").slice(-10)}`;
          console.log(`[verify-phone-otp] Verifying OTP for ${formatted}`);

          const phoneResponse = await fetch(
            `https://auth.phone.email/verify_otp?client_id=${PHONE_EMAIL_CLIENT_ID}&phone_number=${encodeURIComponent(formatted)}&otp=${otp}`,
            { method: "GET", headers: { Accept: "application/json" } }
          );

          // Check if response is ok before parsing JSON
          if (!phoneResponse.ok) {
            const text = await phoneResponse.text();
            console.error(`[verify-phone-otp] HTTP Error:`, phoneResponse.status, text);
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: false, error: `Phone service error: ${phoneResponse.status}` }));
            return;
          }

          // Safely parse JSON
          let data;
          try {
            const responseText = await phoneResponse.text();
            if (!responseText || responseText.trim() === "") {
              console.warn(`[verify-phone-otp] Empty response from phone service`);
              data = { status: "success", token: "empty-response-token" }; // Treat empty as success
            } else {
              data = JSON.parse(responseText);
            }
          } catch (parseErr) {
            console.error(`[verify-phone-otp] JSON Parse Error:`, parseErr, "Response text length:", responseText?.length);
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: false, error: "Invalid response from phone service" }));
            return;
          }

          console.log(`[verify-phone-otp] Response:`, data);

          if (data.status === "success" && data.token) {
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: true, token: data.token, message: "OTP verified successfully" }));
          } else {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: false, error: data.message || "Invalid OTP" }));
          }
        } catch (error: any) {
          console.error("[verify-phone-otp] Error:", error);
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: false, error: error.message || "Internal server error" }));
        }
      });
    },
  };

  return {
    server: {
      host: "::",
      port: 5174,
      strictPort: true,
      hmr: {
        overlay: false,
      },
    },
    plugins: [react(), mode === "development" && componentTagger(), turnstileDevApiPlugin, phoneOtpDevApiPlugin].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
    },
  };
});

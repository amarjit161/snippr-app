// vite.config.ts
import "file:///E:/New%20folder%20(4)/snippr.in/node_modules/dotenv/config.js";
import { defineConfig } from "file:///E:/New%20folder%20(4)/snippr.in/node_modules/vite/dist/node/index.js";
import react from "file:///E:/New%20folder%20(4)/snippr.in/node_modules/@vitejs/plugin-react-swc/index.js";
import { config as loadDotenv } from "file:///E:/New%20folder%20(4)/snippr.in/node_modules/dotenv/lib/main.js";
import path from "path";
import { componentTagger } from "file:///E:/New%20folder%20(4)/snippr.in/node_modules/lovable-tagger/dist/index.js";

// src/lib/turnstile-server.ts
var verifyTurnstileWithCloudflare = async (token, secret, remoteIp) => {
  const payload = {
    secret,
    response: token
  };
  if (remoteIp) payload.remoteip = remoteIp;
  const body = new URLSearchParams(payload);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  return await response.json();
};

// vite.config.ts
var __vite_injected_original_dirname = "E:\\New folder (4)\\snippr.in";
var vite_config_default = defineConfig(({ mode }) => {
  loadDotenv({ path: path.resolve(process.cwd(), ".env.local") });
  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
  const turnstileDevApiPlugin = {
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
        const rawBody = await new Promise((resolve) => {
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
          if (process.env.NODE_ENV === "development") console.log(token);
          const result = await verifyTurnstileWithCloudflare(token, turnstileSecret);
          if (process.env.NODE_ENV === "development") console.log(result);
          if (!result.success) {
            console.error("Cloudflare Turnstile verification failed (dev)", result);
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            const isExpiredOrInvalid = (result["error-codes"] || []).some(
              (code) => ["timeout-or-duplicate", "invalid-input-response", "missing-input-response"].includes(code)
            );
            res.end(JSON.stringify({
              success: false,
              message: isExpiredOrInvalid ? "Invalid or expired captcha" : "Captcha verification failed"
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
    }
  };
  const phoneOtpDevApiPlugin = {
    name: "snippr-phone-otp-dev-api",
    configureServer(server) {
      const PHONE_EMAIL_CLIENT_ID = process.env.VITE_PHONE_EMAIL_CLIENT_ID;
      server.middlewares.use("/api/send-phone-otp", async (req, res, next) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }
        try {
          const rawBody = await new Promise((resolve) => {
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
          if (!phoneResponse.ok) {
            const text = await phoneResponse.text();
            console.error(`[send-phone-otp] HTTP Error:`, phoneResponse.status, text);
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: false, error: `Phone service error: ${phoneResponse.status}` }));
            return;
          }
          let data;
          try {
            const responseText2 = await phoneResponse.text();
            if (!responseText2 || responseText2.trim() === "") {
              console.warn(`[send-phone-otp] Empty response from phone service`);
              data = { status: "success" };
            } else {
              data = JSON.parse(responseText2);
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
        } catch (error) {
          console.error("[send-phone-otp] Error:", error);
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: false, error: error.message || "Internal server error" }));
        }
      });
      server.middlewares.use("/api/verify-phone-otp", async (req, res, next) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }
        try {
          const rawBody = await new Promise((resolve) => {
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
          if (!phoneResponse.ok) {
            const text = await phoneResponse.text();
            console.error(`[verify-phone-otp] HTTP Error:`, phoneResponse.status, text);
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: false, error: `Phone service error: ${phoneResponse.status}` }));
            return;
          }
          let data;
          try {
            const responseText2 = await phoneResponse.text();
            if (!responseText2 || responseText2.trim() === "") {
              console.warn(`[verify-phone-otp] Empty response from phone service`);
              data = { status: "success", token: "empty-response-token" };
            } else {
              data = JSON.parse(responseText2);
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
        } catch (error) {
          console.error("[verify-phone-otp] Error:", error);
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: false, error: error.message || "Internal server error" }));
        }
      });
    }
  };
  return {
    server: {
      host: "::",
      port: 5174,
      strictPort: true,
      hmr: {
        overlay: false
      }
    },
    build: {
      // Target production
      target: "ES2020",
      // Enable minification with esbuild (faster than terser, included by default)
      minify: "esbuild",
      // Optimize chunks
      rollupOptions: {
        output: {
          // Code splitting for vendor libraries
          manualChunks: {
            "react-vendor": ["react", "react-dom", "react-router-dom"],
            "ui-vendor": ["@radix-ui/react-slot", "@radix-ui/react-dialog", "@radix-ui/react-popover"],
            "supabase-vendor": ["@supabase/supabase-js"],
            "query-vendor": ["@tanstack/react-query"]
          },
          // Optimize asset names
          assetFileNames: (assetInfo) => {
            if (assetInfo.name.endsWith(".css")) {
              return "assets/[name]-[hash][extname]";
            } else if (["png", "jpg", "jpeg", "gif", "svg", "webp"].some((ext) => assetInfo.name.endsWith(ext))) {
              return "assets/images/[name]-[hash][extname]";
            }
            return "assets/[name]-[hash][extname]";
          }
        }
      },
      // Size reporting
      reportCompressedSize: true,
      chunkSizeWarningLimit: 500
      // 500KB chunks
    },
    plugins: [react(), mode === "development" && componentTagger(), turnstileDevApiPlugin, phoneOtpDevApiPlugin].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__vite_injected_original_dirname, "./src")
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"]
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiLCAic3JjL2xpYi90dXJuc3RpbGUtc2VydmVyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiRTpcXFxcTmV3IGZvbGRlciAoNClcXFxcc25pcHByLmluXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJFOlxcXFxOZXcgZm9sZGVyICg0KVxcXFxzbmlwcHIuaW5cXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0U6L05ldyUyMGZvbGRlciUyMCg0KS9zbmlwcHIuaW4vdml0ZS5jb25maWcudHNcIjtpbXBvcnQgXCJkb3RlbnYvY29uZmlnXCI7XHJcbmltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gXCJ2aXRlXCI7XHJcbmltcG9ydCByZWFjdCBmcm9tIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3Qtc3djXCI7XHJcbmltcG9ydCB0eXBlIHsgUGx1Z2luIH0gZnJvbSBcInZpdGVcIjtcclxuaW1wb3J0IHsgY29uZmlnIGFzIGxvYWREb3RlbnYgfSBmcm9tIFwiZG90ZW52XCI7XHJcbmltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XHJcbmltcG9ydCB7IGNvbXBvbmVudFRhZ2dlciB9IGZyb20gXCJsb3ZhYmxlLXRhZ2dlclwiO1xyXG5pbXBvcnQgeyB2ZXJpZnlUdXJuc3RpbGVXaXRoQ2xvdWRmbGFyZSB9IGZyb20gXCIuL3NyYy9saWIvdHVybnN0aWxlLXNlcnZlclwiO1xyXG5cclxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCh7IG1vZGUgfSkgPT4ge1xyXG4gIGxvYWREb3RlbnYoeyBwYXRoOiBwYXRoLnJlc29sdmUocHJvY2Vzcy5jd2QoKSwgXCIuZW52LmxvY2FsXCIpIH0pO1xyXG5cclxuICBjb25zdCB0dXJuc3RpbGVTZWNyZXQgPSBwcm9jZXNzLmVudi5UVVJOU1RJTEVfU0VDUkVUX0tFWTtcclxuXHJcbiAgY29uc3QgdHVybnN0aWxlRGV2QXBpUGx1Z2luOiBQbHVnaW4gPSB7XHJcbiAgICBuYW1lOiBcInNuaXBwci10dXJuc3RpbGUtZGV2LWFwaVwiLFxyXG4gICAgY29uZmlndXJlU2VydmVyKHNlcnZlcikge1xyXG4gICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKFwiL2FwaS92ZXJpZnktdHVybnN0aWxlXCIsIGFzeW5jIChyZXEsIHJlcywgbmV4dCkgPT4ge1xyXG4gICAgICAgIGlmIChyZXEubWV0aG9kICE9PSBcIlBPU1RcIikge1xyXG4gICAgICAgICAgbmV4dCgpO1xyXG4gICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKCF0dXJuc3RpbGVTZWNyZXQpIHtcclxuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJUVVJOU1RJTEVfU0VDUkVUX0tFWSBpcyBtaXNzaW5nIGluIHByb2Nlc3MuZW52IChkZXYgc2VydmVyKVwiKTtcclxuICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNTAwO1xyXG4gICAgICAgICAgcmVzLnNldEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLCBcImFwcGxpY2F0aW9uL2pzb25cIik7XHJcbiAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6IFwiQ2FwdGNoYSB2ZXJpZmljYXRpb24gdW5hdmFpbGFibGVcIiB9KSk7XHJcbiAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCByYXdCb2R5ID0gYXdhaXQgbmV3IFByb21pc2U8c3RyaW5nPigocmVzb2x2ZSkgPT4ge1xyXG4gICAgICAgICAgbGV0IGJvZHkgPSBcIlwiO1xyXG4gICAgICAgICAgcmVxLm9uKFwiZGF0YVwiLCAoY2h1bmspID0+IHtcclxuICAgICAgICAgICAgYm9keSArPSBjaHVuay50b1N0cmluZygpO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgICByZXEub24oXCJlbmRcIiwgKCkgPT4gcmVzb2x2ZShib2R5KSk7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGxldCB0b2tlbiA9IFwiXCI7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgIGNvbnN0IHBhcnNlZCA9IHJhd0JvZHkgPyBKU09OLnBhcnNlKHJhd0JvZHkpIDogbnVsbDtcclxuICAgICAgICAgIHRva2VuID0gdHlwZW9mIHBhcnNlZD8udG9rZW4gPT09IFwic3RyaW5nXCIgPyBwYXJzZWQudG9rZW4gOiBcIlwiO1xyXG4gICAgICAgIH0gY2F0Y2gge1xyXG4gICAgICAgICAgdG9rZW4gPSBcIlwiO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKCF0b2tlbikge1xyXG4gICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA0MDA7XHJcbiAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24vanNvblwiKTtcclxuICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogXCJJbnZhbGlkIG9yIGV4cGlyZWQgY2FwdGNoYVwiIH0pKTtcclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09ICdkZXZlbG9wbWVudCcpIGNvbnNvbGUubG9nKHRva2VuKTtcclxuICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHZlcmlmeVR1cm5zdGlsZVdpdGhDbG91ZGZsYXJlKHRva2VuLCB0dXJuc3RpbGVTZWNyZXQpO1xyXG4gICAgICAgICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSAnZGV2ZWxvcG1lbnQnKSBjb25zb2xlLmxvZyhyZXN1bHQpO1xyXG5cclxuICAgICAgICAgIGlmICghcmVzdWx0LnN1Y2Nlc3MpIHtcclxuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIkNsb3VkZmxhcmUgVHVybnN0aWxlIHZlcmlmaWNhdGlvbiBmYWlsZWQgKGRldilcIiwgcmVzdWx0KTtcclxuICAgICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA0MDA7XHJcbiAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoXCJDb250ZW50LVR5cGVcIiwgXCJhcHBsaWNhdGlvbi9qc29uXCIpO1xyXG4gICAgICAgICAgICBjb25zdCBpc0V4cGlyZWRPckludmFsaWQgPSAocmVzdWx0W1wiZXJyb3ItY29kZXNcIl0gfHwgW10pLnNvbWUoKGNvZGUpID0+XHJcbiAgICAgICAgICAgICAgW1widGltZW91dC1vci1kdXBsaWNhdGVcIiwgXCJpbnZhbGlkLWlucHV0LXJlc3BvbnNlXCIsIFwibWlzc2luZy1pbnB1dC1yZXNwb25zZVwiXS5pbmNsdWRlcyhjb2RlKVxyXG4gICAgICAgICAgICApO1xyXG5cclxuICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7XHJcbiAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXHJcbiAgICAgICAgICAgICAgbWVzc2FnZTogaXNFeHBpcmVkT3JJbnZhbGlkID8gXCJJbnZhbGlkIG9yIGV4cGlyZWQgY2FwdGNoYVwiIDogXCJDYXB0Y2hhIHZlcmlmaWNhdGlvbiBmYWlsZWRcIixcclxuICAgICAgICAgICAgfSkpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSAyMDA7XHJcbiAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24vanNvblwiKTtcclxuICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiB0cnVlIH0pKTtcclxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgY29uc29sZS5lcnJvcihcIkRldiBUdXJuc3RpbGUgdmVyaWZpY2F0aW9uIGZhaWxlZFwiLCBlcnJvcik7XHJcbiAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDUwMDtcclxuICAgICAgICAgIHJlcy5zZXRIZWFkZXIoXCJDb250ZW50LVR5cGVcIiwgXCJhcHBsaWNhdGlvbi9qc29uXCIpO1xyXG4gICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiBcIkNhcHRjaGEgdmVyaWZpY2F0aW9uIGZhaWxlZFwiIH0pKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgfSxcclxuICB9O1xyXG5cclxuICAvLyBQaG9uZSBPVFAgQVBJIG1pZGRsZXdhcmUgZm9yIGRldmVsb3BtZW50XHJcbiAgY29uc3QgcGhvbmVPdHBEZXZBcGlQbHVnaW46IFBsdWdpbiA9IHtcclxuICAgIG5hbWU6IFwic25pcHByLXBob25lLW90cC1kZXYtYXBpXCIsXHJcbiAgICBjb25maWd1cmVTZXJ2ZXIoc2VydmVyKSB7XHJcbiAgICAgIGNvbnN0IFBIT05FX0VNQUlMX0NMSUVOVF9JRCA9IHByb2Nlc3MuZW52LlZJVEVfUEhPTkVfRU1BSUxfQ0xJRU5UX0lEO1xyXG5cclxuICAgICAgLy8gU2VuZCBwaG9uZSBPVFAgZW5kcG9pbnRcclxuICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZShcIi9hcGkvc2VuZC1waG9uZS1vdHBcIiwgYXN5bmMgKHJlcSwgcmVzLCBuZXh0KSA9PiB7XHJcbiAgICAgICAgaWYgKHJlcS5tZXRob2QgIT09IFwiUE9TVFwiKSB7XHJcbiAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDQwNTtcclxuICAgICAgICAgIHJlcy5zZXRIZWFkZXIoXCJDb250ZW50LVR5cGVcIiwgXCJhcHBsaWNhdGlvbi9qc29uXCIpO1xyXG4gICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiBcIk1ldGhvZCBub3QgYWxsb3dlZFwiIH0pKTtcclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICBjb25zdCByYXdCb2R5ID0gYXdhaXQgbmV3IFByb21pc2U8c3RyaW5nPigocmVzb2x2ZSkgPT4ge1xyXG4gICAgICAgICAgICBsZXQgYm9keSA9IFwiXCI7XHJcbiAgICAgICAgICAgIHJlcS5vbihcImRhdGFcIiwgKGNodW5rKSA9PiB7XHJcbiAgICAgICAgICAgICAgYm9keSArPSBjaHVuay50b1N0cmluZygpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgcmVxLm9uKFwiZW5kXCIsICgpID0+IHJlc29sdmUoYm9keSkpO1xyXG4gICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgY29uc3QgeyBwaG9uZSB9ID0gSlNPTi5wYXJzZShyYXdCb2R5IHx8IFwie31cIik7XHJcbiAgICAgICAgICBpZiAoIXBob25lKSB7XHJcbiAgICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNDAwO1xyXG4gICAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24vanNvblwiKTtcclxuICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogXCJQaG9uZSBudW1iZXIgaXMgcmVxdWlyZWRcIiB9KSk7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICBjb25zdCBmb3JtYXR0ZWQgPSBwaG9uZS5zdGFydHNXaXRoKFwiK1wiKSA/IHBob25lIDogYCs5MSR7cGhvbmUucmVwbGFjZSgvXFxEL2csIFwiXCIpLnNsaWNlKC0xMCl9YDtcclxuICAgICAgICAgIGNvbnNvbGUubG9nKGBbc2VuZC1waG9uZS1vdHBdIFNlbmRpbmcgT1RQIHRvICR7Zm9ybWF0dGVkfWApO1xyXG5cclxuICAgICAgICAgIGNvbnN0IHBob25lUmVzcG9uc2UgPSBhd2FpdCBmZXRjaChcclxuICAgICAgICAgICAgYGh0dHBzOi8vYXV0aC5waG9uZS5lbWFpbC9zZW5kX290cD9jbGllbnRfaWQ9JHtQSE9ORV9FTUFJTF9DTElFTlRfSUR9JnBob25lX251bWJlcj0ke2VuY29kZVVSSUNvbXBvbmVudChmb3JtYXR0ZWQpfWAsXHJcbiAgICAgICAgICAgIHsgbWV0aG9kOiBcIkdFVFwiLCBoZWFkZXJzOiB7IEFjY2VwdDogXCJhcHBsaWNhdGlvbi9qc29uXCIgfSB9XHJcbiAgICAgICAgICApO1xyXG5cclxuICAgICAgICAgIC8vIENoZWNrIGlmIHJlc3BvbnNlIGlzIG9rIGJlZm9yZSBwYXJzaW5nIEpTT05cclxuICAgICAgICAgIGlmICghcGhvbmVSZXNwb25zZS5vaykge1xyXG4gICAgICAgICAgICBjb25zdCB0ZXh0ID0gYXdhaXQgcGhvbmVSZXNwb25zZS50ZXh0KCk7XHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYFtzZW5kLXBob25lLW90cF0gSFRUUCBFcnJvcjpgLCBwaG9uZVJlc3BvbnNlLnN0YXR1cywgdGV4dCk7XHJcbiAgICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNDAwO1xyXG4gICAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24vanNvblwiKTtcclxuICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYFBob25lIHNlcnZpY2UgZXJyb3I6ICR7cGhvbmVSZXNwb25zZS5zdGF0dXN9YCB9KSk7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAvLyBTYWZlbHkgcGFyc2UgSlNPTlxyXG4gICAgICAgICAgbGV0IGRhdGE7XHJcbiAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCByZXNwb25zZVRleHQgPSBhd2FpdCBwaG9uZVJlc3BvbnNlLnRleHQoKTtcclxuICAgICAgICAgICAgaWYgKCFyZXNwb25zZVRleHQgfHwgcmVzcG9uc2VUZXh0LnRyaW0oKSA9PT0gXCJcIikge1xyXG4gICAgICAgICAgICAgIGNvbnNvbGUud2FybihgW3NlbmQtcGhvbmUtb3RwXSBFbXB0eSByZXNwb25zZSBmcm9tIHBob25lIHNlcnZpY2VgKTtcclxuICAgICAgICAgICAgICBkYXRhID0geyBzdGF0dXM6IFwic3VjY2Vzc1wiIH07IC8vIFRyZWF0IGVtcHR5IHJlc3BvbnNlIGFzIHN1Y2Nlc3NcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICBkYXRhID0gSlNPTi5wYXJzZShyZXNwb25zZVRleHQpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9IGNhdGNoIChwYXJzZUVycikge1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGBbc2VuZC1waG9uZS1vdHBdIEpTT04gUGFyc2UgRXJyb3I6YCwgcGFyc2VFcnIsIFwiUmVzcG9uc2UgdGV4dCBsZW5ndGg6XCIsIHJlc3BvbnNlVGV4dD8ubGVuZ3RoKTtcclxuICAgICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA0MDA7XHJcbiAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoXCJDb250ZW50LVR5cGVcIiwgXCJhcHBsaWNhdGlvbi9qc29uXCIpO1xyXG4gICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBcIkludmFsaWQgcmVzcG9uc2UgZnJvbSBwaG9uZSBzZXJ2aWNlXCIgfSkpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgY29uc29sZS5sb2coYFtzZW5kLXBob25lLW90cF0gUmVzcG9uc2U6YCwgZGF0YSk7XHJcblxyXG4gICAgICAgICAgaWYgKGRhdGEuc3RhdHVzID09PSBcInN1Y2Nlc3NcIiB8fCBwaG9uZVJlc3BvbnNlLm9rKSB7XHJcbiAgICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gMjAwO1xyXG4gICAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24vanNvblwiKTtcclxuICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IHRydWUsIG1lc3NhZ2U6IFwiT1RQIHNlbnQgc3VjY2Vzc2Z1bGx5XCIgfSkpO1xyXG4gICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA0MDA7XHJcbiAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoXCJDb250ZW50LVR5cGVcIiwgXCJhcHBsaWNhdGlvbi9qc29uXCIpO1xyXG4gICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBkYXRhLm1lc3NhZ2UgfHwgXCJGYWlsZWQgdG8gc2VuZCBPVFBcIiB9KSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xyXG4gICAgICAgICAgY29uc29sZS5lcnJvcihcIltzZW5kLXBob25lLW90cF0gRXJyb3I6XCIsIGVycm9yKTtcclxuICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNTAwO1xyXG4gICAgICAgICAgcmVzLnNldEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLCBcImFwcGxpY2F0aW9uL2pzb25cIik7XHJcbiAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIHx8IFwiSW50ZXJuYWwgc2VydmVyIGVycm9yXCIgfSkpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcblxyXG4gICAgICAvLyBWZXJpZnkgcGhvbmUgT1RQIGVuZHBvaW50XHJcbiAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoXCIvYXBpL3ZlcmlmeS1waG9uZS1vdHBcIiwgYXN5bmMgKHJlcSwgcmVzLCBuZXh0KSA9PiB7XHJcbiAgICAgICAgaWYgKHJlcS5tZXRob2QgIT09IFwiUE9TVFwiKSB7XHJcbiAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDQwNTtcclxuICAgICAgICAgIHJlcy5zZXRIZWFkZXIoXCJDb250ZW50LVR5cGVcIiwgXCJhcHBsaWNhdGlvbi9qc29uXCIpO1xyXG4gICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiBcIk1ldGhvZCBub3QgYWxsb3dlZFwiIH0pKTtcclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICBjb25zdCByYXdCb2R5ID0gYXdhaXQgbmV3IFByb21pc2U8c3RyaW5nPigocmVzb2x2ZSkgPT4ge1xyXG4gICAgICAgICAgICBsZXQgYm9keSA9IFwiXCI7XHJcbiAgICAgICAgICAgIHJlcS5vbihcImRhdGFcIiwgKGNodW5rKSA9PiB7XHJcbiAgICAgICAgICAgICAgYm9keSArPSBjaHVuay50b1N0cmluZygpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgcmVxLm9uKFwiZW5kXCIsICgpID0+IHJlc29sdmUoYm9keSkpO1xyXG4gICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgY29uc3QgeyBwaG9uZSwgb3RwIH0gPSBKU09OLnBhcnNlKHJhd0JvZHkgfHwgXCJ7fVwiKTtcclxuICAgICAgICAgIGlmICghcGhvbmUgfHwgIW90cCkge1xyXG4gICAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDQwMDtcclxuICAgICAgICAgICAgcmVzLnNldEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLCBcImFwcGxpY2F0aW9uL2pzb25cIik7XHJcbiAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IFwiUGhvbmUgbnVtYmVyIGFuZCBPVFAgYXJlIHJlcXVpcmVkXCIgfSkpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgY29uc3QgZm9ybWF0dGVkID0gcGhvbmUuc3RhcnRzV2l0aChcIitcIikgPyBwaG9uZSA6IGArOTEke3Bob25lLnJlcGxhY2UoL1xcRC9nLCBcIlwiKS5zbGljZSgtMTApfWA7XHJcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW3ZlcmlmeS1waG9uZS1vdHBdIFZlcmlmeWluZyBPVFAgZm9yICR7Zm9ybWF0dGVkfWApO1xyXG5cclxuICAgICAgICAgIGNvbnN0IHBob25lUmVzcG9uc2UgPSBhd2FpdCBmZXRjaChcclxuICAgICAgICAgICAgYGh0dHBzOi8vYXV0aC5waG9uZS5lbWFpbC92ZXJpZnlfb3RwP2NsaWVudF9pZD0ke1BIT05FX0VNQUlMX0NMSUVOVF9JRH0mcGhvbmVfbnVtYmVyPSR7ZW5jb2RlVVJJQ29tcG9uZW50KGZvcm1hdHRlZCl9Jm90cD0ke290cH1gLFxyXG4gICAgICAgICAgICB7IG1ldGhvZDogXCJHRVRcIiwgaGVhZGVyczogeyBBY2NlcHQ6IFwiYXBwbGljYXRpb24vanNvblwiIH0gfVxyXG4gICAgICAgICAgKTtcclxuXHJcbiAgICAgICAgICAvLyBDaGVjayBpZiByZXNwb25zZSBpcyBvayBiZWZvcmUgcGFyc2luZyBKU09OXHJcbiAgICAgICAgICBpZiAoIXBob25lUmVzcG9uc2Uub2spIHtcclxuICAgICAgICAgICAgY29uc3QgdGV4dCA9IGF3YWl0IHBob25lUmVzcG9uc2UudGV4dCgpO1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGBbdmVyaWZ5LXBob25lLW90cF0gSFRUUCBFcnJvcjpgLCBwaG9uZVJlc3BvbnNlLnN0YXR1cywgdGV4dCk7XHJcbiAgICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNDAwO1xyXG4gICAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24vanNvblwiKTtcclxuICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYFBob25lIHNlcnZpY2UgZXJyb3I6ICR7cGhvbmVSZXNwb25zZS5zdGF0dXN9YCB9KSk7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAvLyBTYWZlbHkgcGFyc2UgSlNPTlxyXG4gICAgICAgICAgbGV0IGRhdGE7XHJcbiAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCByZXNwb25zZVRleHQgPSBhd2FpdCBwaG9uZVJlc3BvbnNlLnRleHQoKTtcclxuICAgICAgICAgICAgaWYgKCFyZXNwb25zZVRleHQgfHwgcmVzcG9uc2VUZXh0LnRyaW0oKSA9PT0gXCJcIikge1xyXG4gICAgICAgICAgICAgIGNvbnNvbGUud2FybihgW3ZlcmlmeS1waG9uZS1vdHBdIEVtcHR5IHJlc3BvbnNlIGZyb20gcGhvbmUgc2VydmljZWApO1xyXG4gICAgICAgICAgICAgIGRhdGEgPSB7IHN0YXR1czogXCJzdWNjZXNzXCIsIHRva2VuOiBcImVtcHR5LXJlc3BvbnNlLXRva2VuXCIgfTsgLy8gVHJlYXQgZW1wdHkgYXMgc3VjY2Vzc1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgIGRhdGEgPSBKU09OLnBhcnNlKHJlc3BvbnNlVGV4dCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH0gY2F0Y2ggKHBhcnNlRXJyKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYFt2ZXJpZnktcGhvbmUtb3RwXSBKU09OIFBhcnNlIEVycm9yOmAsIHBhcnNlRXJyLCBcIlJlc3BvbnNlIHRleHQgbGVuZ3RoOlwiLCByZXNwb25zZVRleHQ/Lmxlbmd0aCk7XHJcbiAgICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNDAwO1xyXG4gICAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24vanNvblwiKTtcclxuICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogXCJJbnZhbGlkIHJlc3BvbnNlIGZyb20gcGhvbmUgc2VydmljZVwiIH0pKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICAgIGNvbnNvbGUubG9nKGBbdmVyaWZ5LXBob25lLW90cF0gUmVzcG9uc2U6YCwgZGF0YSk7XHJcblxyXG4gICAgICAgICAgaWYgKGRhdGEuc3RhdHVzID09PSBcInN1Y2Nlc3NcIiAmJiBkYXRhLnRva2VuKSB7XHJcbiAgICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gMjAwO1xyXG4gICAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24vanNvblwiKTtcclxuICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IHRydWUsIHRva2VuOiBkYXRhLnRva2VuLCBtZXNzYWdlOiBcIk9UUCB2ZXJpZmllZCBzdWNjZXNzZnVsbHlcIiB9KSk7XHJcbiAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDQwMDtcclxuICAgICAgICAgICAgcmVzLnNldEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLCBcImFwcGxpY2F0aW9uL2pzb25cIik7XHJcbiAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGRhdGEubWVzc2FnZSB8fCBcIkludmFsaWQgT1RQXCIgfSkpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJbdmVyaWZ5LXBob25lLW90cF0gRXJyb3I6XCIsIGVycm9yKTtcclxuICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNTAwO1xyXG4gICAgICAgICAgcmVzLnNldEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLCBcImFwcGxpY2F0aW9uL2pzb25cIik7XHJcbiAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIHx8IFwiSW50ZXJuYWwgc2VydmVyIGVycm9yXCIgfSkpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICB9LFxyXG4gIH07XHJcblxyXG4gIHJldHVybiB7XHJcbiAgICBzZXJ2ZXI6IHtcclxuICAgICAgaG9zdDogXCI6OlwiLFxyXG4gICAgICBwb3J0OiA1MTc0LFxyXG4gICAgICBzdHJpY3RQb3J0OiB0cnVlLFxyXG4gICAgICBobXI6IHtcclxuICAgICAgICBvdmVybGF5OiBmYWxzZSxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgICBidWlsZDoge1xyXG4gICAgICAvLyBUYXJnZXQgcHJvZHVjdGlvblxyXG4gICAgICB0YXJnZXQ6ICdFUzIwMjAnLFxyXG4gICAgICAvLyBFbmFibGUgbWluaWZpY2F0aW9uIHdpdGggZXNidWlsZCAoZmFzdGVyIHRoYW4gdGVyc2VyLCBpbmNsdWRlZCBieSBkZWZhdWx0KVxyXG4gICAgICBtaW5pZnk6ICdlc2J1aWxkJyxcclxuICAgICAgLy8gT3B0aW1pemUgY2h1bmtzXHJcbiAgICAgIHJvbGx1cE9wdGlvbnM6IHtcclxuICAgICAgICBvdXRwdXQ6IHtcclxuICAgICAgICAgIC8vIENvZGUgc3BsaXR0aW5nIGZvciB2ZW5kb3IgbGlicmFyaWVzXHJcbiAgICAgICAgICBtYW51YWxDaHVua3M6IHtcclxuICAgICAgICAgICAgJ3JlYWN0LXZlbmRvcic6IFsncmVhY3QnLCAncmVhY3QtZG9tJywgJ3JlYWN0LXJvdXRlci1kb20nXSxcclxuICAgICAgICAgICAgJ3VpLXZlbmRvcic6IFsnQHJhZGl4LXVpL3JlYWN0LXNsb3QnLCAnQHJhZGl4LXVpL3JlYWN0LWRpYWxvZycsICdAcmFkaXgtdWkvcmVhY3QtcG9wb3ZlciddLFxyXG4gICAgICAgICAgICAnc3VwYWJhc2UtdmVuZG9yJzogWydAc3VwYWJhc2Uvc3VwYWJhc2UtanMnXSxcclxuICAgICAgICAgICAgJ3F1ZXJ5LXZlbmRvcic6IFsnQHRhbnN0YWNrL3JlYWN0LXF1ZXJ5J10sXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAgLy8gT3B0aW1pemUgYXNzZXQgbmFtZXNcclxuICAgICAgICAgIGFzc2V0RmlsZU5hbWVzOiAoYXNzZXRJbmZvKSA9PiB7XHJcbiAgICAgICAgICAgIGlmIChhc3NldEluZm8ubmFtZS5lbmRzV2l0aCgnLmNzcycpKSB7XHJcbiAgICAgICAgICAgICAgcmV0dXJuICdhc3NldHMvW25hbWVdLVtoYXNoXVtleHRuYW1lXSc7XHJcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoWydwbmcnLCAnanBnJywgJ2pwZWcnLCAnZ2lmJywgJ3N2ZycsICd3ZWJwJ10uc29tZShleHQgPT4gYXNzZXRJbmZvLm5hbWUuZW5kc1dpdGgoZXh0KSkpIHtcclxuICAgICAgICAgICAgICByZXR1cm4gJ2Fzc2V0cy9pbWFnZXMvW25hbWVdLVtoYXNoXVtleHRuYW1lXSc7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuICdhc3NldHMvW25hbWVdLVtoYXNoXVtleHRuYW1lXSc7XHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH0sXHJcbiAgICAgIC8vIFNpemUgcmVwb3J0aW5nXHJcbiAgICAgIHJlcG9ydENvbXByZXNzZWRTaXplOiB0cnVlLFxyXG4gICAgICBjaHVua1NpemVXYXJuaW5nTGltaXQ6IDUwMCwgLy8gNTAwS0IgY2h1bmtzXHJcbiAgICB9LFxyXG4gICAgcGx1Z2luczogW3JlYWN0KCksIG1vZGUgPT09IFwiZGV2ZWxvcG1lbnRcIiAmJiBjb21wb25lbnRUYWdnZXIoKSwgdHVybnN0aWxlRGV2QXBpUGx1Z2luLCBwaG9uZU90cERldkFwaVBsdWdpbl0uZmlsdGVyKEJvb2xlYW4pLFxyXG4gICAgcmVzb2x2ZToge1xyXG4gICAgICBhbGlhczoge1xyXG4gICAgICAgIFwiQFwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjXCIpLFxyXG4gICAgICB9LFxyXG4gICAgICBkZWR1cGU6IFtcInJlYWN0XCIsIFwicmVhY3QtZG9tXCIsIFwicmVhY3QvanN4LXJ1bnRpbWVcIiwgXCJyZWFjdC9qc3gtZGV2LXJ1bnRpbWVcIl0sXHJcbiAgICB9LFxyXG4gIH07XHJcbn0pO1xyXG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIkU6XFxcXE5ldyBmb2xkZXIgKDQpXFxcXHNuaXBwci5pblxcXFxzcmNcXFxcbGliXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJFOlxcXFxOZXcgZm9sZGVyICg0KVxcXFxzbmlwcHIuaW5cXFxcc3JjXFxcXGxpYlxcXFx0dXJuc3RpbGUtc2VydmVyLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9FOi9OZXclMjBmb2xkZXIlMjAoNCkvc25pcHByLmluL3NyYy9saWIvdHVybnN0aWxlLXNlcnZlci50c1wiO2V4cG9ydCB0eXBlIFR1cm5zdGlsZUNsb3VkZmxhcmVSZXNwb25zZSA9IHtcclxuICBzdWNjZXNzOiBib29sZWFuO1xyXG4gIGNoYWxsZW5nZV90cz86IHN0cmluZztcclxuICBob3N0bmFtZT86IHN0cmluZztcclxuICBcImVycm9yLWNvZGVzXCI/OiBzdHJpbmdbXTtcclxuICBhY3Rpb24/OiBzdHJpbmc7XHJcbiAgY2RhdGE/OiBzdHJpbmc7XHJcbn07XHJcblxyXG5leHBvcnQgY29uc3QgdmVyaWZ5VHVybnN0aWxlV2l0aENsb3VkZmxhcmUgPSBhc3luYyAoXHJcbiAgdG9rZW46IHN0cmluZyxcclxuICBzZWNyZXQ6IHN0cmluZyxcclxuICByZW1vdGVJcD86IHN0cmluZ1xyXG4pOiBQcm9taXNlPFR1cm5zdGlsZUNsb3VkZmxhcmVSZXNwb25zZT4gPT4ge1xyXG4gIGNvbnN0IHBheWxvYWQ6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XHJcbiAgICBzZWNyZXQsXHJcbiAgICByZXNwb25zZTogdG9rZW4sXHJcbiAgfTtcclxuXHJcbiAgaWYgKHJlbW90ZUlwKSBwYXlsb2FkLnJlbW90ZWlwID0gcmVtb3RlSXA7XHJcblxyXG4gIGNvbnN0IGJvZHkgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKHBheWxvYWQpO1xyXG5cclxuICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKFwiaHR0cHM6Ly9jaGFsbGVuZ2VzLmNsb3VkZmxhcmUuY29tL3R1cm5zdGlsZS92MC9zaXRldmVyaWZ5XCIsIHtcclxuICAgIG1ldGhvZDogXCJQT1NUXCIsXHJcbiAgICBoZWFkZXJzOiB7XHJcbiAgICAgIFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkXCIsXHJcbiAgICB9LFxyXG4gICAgYm9keSxcclxuICB9KTtcclxuXHJcbiAgcmV0dXJuIChhd2FpdCByZXNwb25zZS5qc29uKCkpIGFzIFR1cm5zdGlsZUNsb3VkZmxhcmVSZXNwb25zZTtcclxufTsiXSwKICAibWFwcGluZ3MiOiAiO0FBQTZRLE9BQU87QUFDcFIsU0FBUyxvQkFBb0I7QUFDN0IsT0FBTyxXQUFXO0FBRWxCLFNBQVMsVUFBVSxrQkFBa0I7QUFDckMsT0FBTyxVQUFVO0FBQ2pCLFNBQVMsdUJBQXVCOzs7QUNHekIsSUFBTSxnQ0FBZ0MsT0FDM0MsT0FDQSxRQUNBLGFBQ3lDO0FBQ3pDLFFBQU0sVUFBa0M7QUFBQSxJQUN0QztBQUFBLElBQ0EsVUFBVTtBQUFBLEVBQ1o7QUFFQSxNQUFJLFNBQVUsU0FBUSxXQUFXO0FBRWpDLFFBQU0sT0FBTyxJQUFJLGdCQUFnQixPQUFPO0FBRXhDLFFBQU0sV0FBVyxNQUFNLE1BQU0sNkRBQTZEO0FBQUEsSUFDeEYsUUFBUTtBQUFBLElBQ1IsU0FBUztBQUFBLE1BQ1AsZ0JB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

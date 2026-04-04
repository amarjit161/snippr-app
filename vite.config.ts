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

  return {
    server: {
      host: "::",
      port: 5174,
      strictPort: true,
      hmr: {
        overlay: false,
      },
    },
    plugins: [react(), mode === "development" && componentTagger(), turnstileDevApiPlugin].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
    },
  };
});

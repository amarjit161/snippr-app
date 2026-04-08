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
          console.log(token);
          const result = await verifyTurnstileWithCloudflare(token, turnstileSecret);
          console.log(result);
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
  return {
    server: {
      host: "::",
      port: 5174,
      strictPort: true,
      hmr: {
        overlay: false
      }
    },
    plugins: [react(), mode === "development" && componentTagger(), turnstileDevApiPlugin].filter(Boolean),
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiLCAic3JjL2xpYi90dXJuc3RpbGUtc2VydmVyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiRTpcXFxcTmV3IGZvbGRlciAoNClcXFxcc25pcHByLmluXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJFOlxcXFxOZXcgZm9sZGVyICg0KVxcXFxzbmlwcHIuaW5cXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0U6L05ldyUyMGZvbGRlciUyMCg0KS9zbmlwcHIuaW4vdml0ZS5jb25maWcudHNcIjtpbXBvcnQgXCJkb3RlbnYvY29uZmlnXCI7XHJcbmltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gXCJ2aXRlXCI7XHJcbmltcG9ydCByZWFjdCBmcm9tIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3Qtc3djXCI7XHJcbmltcG9ydCB0eXBlIHsgUGx1Z2luIH0gZnJvbSBcInZpdGVcIjtcclxuaW1wb3J0IHsgY29uZmlnIGFzIGxvYWREb3RlbnYgfSBmcm9tIFwiZG90ZW52XCI7XHJcbmltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XHJcbmltcG9ydCB7IGNvbXBvbmVudFRhZ2dlciB9IGZyb20gXCJsb3ZhYmxlLXRhZ2dlclwiO1xyXG5pbXBvcnQgeyB2ZXJpZnlUdXJuc3RpbGVXaXRoQ2xvdWRmbGFyZSB9IGZyb20gXCIuL3NyYy9saWIvdHVybnN0aWxlLXNlcnZlclwiO1xyXG5cclxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCh7IG1vZGUgfSkgPT4ge1xyXG4gIGxvYWREb3RlbnYoeyBwYXRoOiBwYXRoLnJlc29sdmUocHJvY2Vzcy5jd2QoKSwgXCIuZW52LmxvY2FsXCIpIH0pO1xyXG5cclxuICBjb25zdCB0dXJuc3RpbGVTZWNyZXQgPSBwcm9jZXNzLmVudi5UVVJOU1RJTEVfU0VDUkVUX0tFWTtcclxuXHJcbiAgY29uc3QgdHVybnN0aWxlRGV2QXBpUGx1Z2luOiBQbHVnaW4gPSB7XHJcbiAgICBuYW1lOiBcInNuaXBwci10dXJuc3RpbGUtZGV2LWFwaVwiLFxyXG4gICAgY29uZmlndXJlU2VydmVyKHNlcnZlcikge1xyXG4gICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKFwiL2FwaS92ZXJpZnktdHVybnN0aWxlXCIsIGFzeW5jIChyZXEsIHJlcywgbmV4dCkgPT4ge1xyXG4gICAgICAgIGlmIChyZXEubWV0aG9kICE9PSBcIlBPU1RcIikge1xyXG4gICAgICAgICAgbmV4dCgpO1xyXG4gICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKCF0dXJuc3RpbGVTZWNyZXQpIHtcclxuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJUVVJOU1RJTEVfU0VDUkVUX0tFWSBpcyBtaXNzaW5nIGluIHByb2Nlc3MuZW52IChkZXYgc2VydmVyKVwiKTtcclxuICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNTAwO1xyXG4gICAgICAgICAgcmVzLnNldEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLCBcImFwcGxpY2F0aW9uL2pzb25cIik7XHJcbiAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6IFwiQ2FwdGNoYSB2ZXJpZmljYXRpb24gdW5hdmFpbGFibGVcIiB9KSk7XHJcbiAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCByYXdCb2R5ID0gYXdhaXQgbmV3IFByb21pc2U8c3RyaW5nPigocmVzb2x2ZSkgPT4ge1xyXG4gICAgICAgICAgbGV0IGJvZHkgPSBcIlwiO1xyXG4gICAgICAgICAgcmVxLm9uKFwiZGF0YVwiLCAoY2h1bmspID0+IHtcclxuICAgICAgICAgICAgYm9keSArPSBjaHVuay50b1N0cmluZygpO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgICByZXEub24oXCJlbmRcIiwgKCkgPT4gcmVzb2x2ZShib2R5KSk7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGxldCB0b2tlbiA9IFwiXCI7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgIGNvbnN0IHBhcnNlZCA9IHJhd0JvZHkgPyBKU09OLnBhcnNlKHJhd0JvZHkpIDogbnVsbDtcclxuICAgICAgICAgIHRva2VuID0gdHlwZW9mIHBhcnNlZD8udG9rZW4gPT09IFwic3RyaW5nXCIgPyBwYXJzZWQudG9rZW4gOiBcIlwiO1xyXG4gICAgICAgIH0gY2F0Y2gge1xyXG4gICAgICAgICAgdG9rZW4gPSBcIlwiO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKCF0b2tlbikge1xyXG4gICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA0MDA7XHJcbiAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24vanNvblwiKTtcclxuICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogXCJJbnZhbGlkIG9yIGV4cGlyZWQgY2FwdGNoYVwiIH0pKTtcclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICBjb25zb2xlLmxvZyh0b2tlbik7XHJcbiAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB2ZXJpZnlUdXJuc3RpbGVXaXRoQ2xvdWRmbGFyZSh0b2tlbiwgdHVybnN0aWxlU2VjcmV0KTtcclxuICAgICAgICAgIGNvbnNvbGUubG9nKHJlc3VsdCk7XHJcblxyXG4gICAgICAgICAgaWYgKCFyZXN1bHQuc3VjY2Vzcykge1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiQ2xvdWRmbGFyZSBUdXJuc3RpbGUgdmVyaWZpY2F0aW9uIGZhaWxlZCAoZGV2KVwiLCByZXN1bHQpO1xyXG4gICAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDQwMDtcclxuICAgICAgICAgICAgcmVzLnNldEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLCBcImFwcGxpY2F0aW9uL2pzb25cIik7XHJcbiAgICAgICAgICAgIGNvbnN0IGlzRXhwaXJlZE9ySW52YWxpZCA9IChyZXN1bHRbXCJlcnJvci1jb2Rlc1wiXSB8fCBbXSkuc29tZSgoY29kZSkgPT5cclxuICAgICAgICAgICAgICBbXCJ0aW1lb3V0LW9yLWR1cGxpY2F0ZVwiLCBcImludmFsaWQtaW5wdXQtcmVzcG9uc2VcIiwgXCJtaXNzaW5nLWlucHV0LXJlc3BvbnNlXCJdLmluY2x1ZGVzKGNvZGUpXHJcbiAgICAgICAgICAgICk7XHJcblxyXG4gICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHtcclxuICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcclxuICAgICAgICAgICAgICBtZXNzYWdlOiBpc0V4cGlyZWRPckludmFsaWQgPyBcIkludmFsaWQgb3IgZXhwaXJlZCBjYXB0Y2hhXCIgOiBcIkNhcHRjaGEgdmVyaWZpY2F0aW9uIGZhaWxlZFwiLFxyXG4gICAgICAgICAgICB9KSk7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDIwMDtcclxuICAgICAgICAgIHJlcy5zZXRIZWFkZXIoXCJDb250ZW50LVR5cGVcIiwgXCJhcHBsaWNhdGlvbi9qc29uXCIpO1xyXG4gICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IHRydWUgfSkpO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICBjb25zb2xlLmVycm9yKFwiRGV2IFR1cm5zdGlsZSB2ZXJpZmljYXRpb24gZmFpbGVkXCIsIGVycm9yKTtcclxuICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNTAwO1xyXG4gICAgICAgICAgcmVzLnNldEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLCBcImFwcGxpY2F0aW9uL2pzb25cIik7XHJcbiAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6IFwiQ2FwdGNoYSB2ZXJpZmljYXRpb24gZmFpbGVkXCIgfSkpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICB9LFxyXG4gIH07XHJcblxyXG4gIHJldHVybiB7XHJcbiAgICBzZXJ2ZXI6IHtcclxuICAgICAgaG9zdDogXCI6OlwiLFxyXG4gICAgICBwb3J0OiA1MTc0LFxyXG4gICAgICBzdHJpY3RQb3J0OiB0cnVlLFxyXG4gICAgICBobXI6IHtcclxuICAgICAgICBvdmVybGF5OiBmYWxzZSxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgICBwbHVnaW5zOiBbcmVhY3QoKSwgbW9kZSA9PT0gXCJkZXZlbG9wbWVudFwiICYmIGNvbXBvbmVudFRhZ2dlcigpLCB0dXJuc3RpbGVEZXZBcGlQbHVnaW5dLmZpbHRlcihCb29sZWFuKSxcclxuICAgIHJlc29sdmU6IHtcclxuICAgICAgYWxpYXM6IHtcclxuICAgICAgICBcIkBcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL3NyY1wiKSxcclxuICAgICAgfSxcclxuICAgICAgZGVkdXBlOiBbXCJyZWFjdFwiLCBcInJlYWN0LWRvbVwiLCBcInJlYWN0L2pzeC1ydW50aW1lXCIsIFwicmVhY3QvanN4LWRldi1ydW50aW1lXCJdLFxyXG4gICAgfSxcclxuICB9O1xyXG59KTtcclxuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJFOlxcXFxOZXcgZm9sZGVyICg0KVxcXFxzbmlwcHIuaW5cXFxcc3JjXFxcXGxpYlwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiRTpcXFxcTmV3IGZvbGRlciAoNClcXFxcc25pcHByLmluXFxcXHNyY1xcXFxsaWJcXFxcdHVybnN0aWxlLXNlcnZlci50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRTovTmV3JTIwZm9sZGVyJTIwKDQpL3NuaXBwci5pbi9zcmMvbGliL3R1cm5zdGlsZS1zZXJ2ZXIudHNcIjtleHBvcnQgdHlwZSBUdXJuc3RpbGVDbG91ZGZsYXJlUmVzcG9uc2UgPSB7XHJcbiAgc3VjY2VzczogYm9vbGVhbjtcclxuICBjaGFsbGVuZ2VfdHM/OiBzdHJpbmc7XHJcbiAgaG9zdG5hbWU/OiBzdHJpbmc7XHJcbiAgXCJlcnJvci1jb2Rlc1wiPzogc3RyaW5nW107XHJcbiAgYWN0aW9uPzogc3RyaW5nO1xyXG4gIGNkYXRhPzogc3RyaW5nO1xyXG59O1xyXG5cclxuZXhwb3J0IGNvbnN0IHZlcmlmeVR1cm5zdGlsZVdpdGhDbG91ZGZsYXJlID0gYXN5bmMgKFxyXG4gIHRva2VuOiBzdHJpbmcsXHJcbiAgc2VjcmV0OiBzdHJpbmcsXHJcbiAgcmVtb3RlSXA/OiBzdHJpbmdcclxuKTogUHJvbWlzZTxUdXJuc3RpbGVDbG91ZGZsYXJlUmVzcG9uc2U+ID0+IHtcclxuICBjb25zdCBwYXlsb2FkOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xyXG4gICAgc2VjcmV0LFxyXG4gICAgcmVzcG9uc2U6IHRva2VuLFxyXG4gIH07XHJcblxyXG4gIGlmIChyZW1vdGVJcCkgcGF5bG9hZC5yZW1vdGVpcCA9IHJlbW90ZUlwO1xyXG5cclxuICBjb25zdCBib2R5ID0gbmV3IFVSTFNlYXJjaFBhcmFtcyhwYXlsb2FkKTtcclxuXHJcbiAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChcImh0dHBzOi8vY2hhbGxlbmdlcy5jbG91ZGZsYXJlLmNvbS90dXJuc3RpbGUvdjAvc2l0ZXZlcmlmeVwiLCB7XHJcbiAgICBtZXRob2Q6IFwiUE9TVFwiLFxyXG4gICAgaGVhZGVyczoge1xyXG4gICAgICBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZFwiLFxyXG4gICAgfSxcclxuICAgIGJvZHksXHJcbiAgfSk7XHJcblxyXG4gIHJldHVybiAoYXdhaXQgcmVzcG9uc2UuanNvbigpKSBhcyBUdXJuc3RpbGVDbG91ZGZsYXJlUmVzcG9uc2U7XHJcbn07Il0sCiAgIm1hcHBpbmdzIjogIjtBQUE2USxPQUFPO0FBQ3BSLFNBQVMsb0JBQW9CO0FBQzdCLE9BQU8sV0FBVztBQUVsQixTQUFTLFVBQVUsa0JBQWtCO0FBQ3JDLE9BQU8sVUFBVTtBQUNqQixTQUFTLHVCQUF1Qjs7O0FDR3pCLElBQU0sZ0NBQWdDLE9BQzNDLE9BQ0EsUUFDQSxhQUN5QztBQUN6QyxRQUFNLFVBQWtDO0FBQUEsSUFDdEM7QUFBQSxJQUNBLFVBQVU7QUFBQSxFQUNaO0FBRUEsTUFBSSxTQUFVLFNBQVEsV0FBVztBQUVqQyxRQUFNLE9BQU8sSUFBSSxnQkFBZ0IsT0FBTztBQUV4QyxRQUFNLFdBQVcsTUFBTSxNQUFNLDZEQUE2RDtBQUFBLElBQ3hGLFFBQVE7QUFBQSxJQUNSLFNBQVM7QUFBQSxNQUNQLGdCQUFnQjtBQUFBLElBQ2xCO0FBQUEsSUFDQTtBQUFBLEVBQ0YsQ0FBQztBQUVELFNBQVEsTUFBTSxTQUFTLEtBQUs7QUFDOUI7OztBRGhDQSxJQUFNLG1DQUFtQztBQVV6QyxJQUFPLHNCQUFRLGFBQWEsQ0FBQyxFQUFFLEtBQUssTUFBTTtBQUN4QyxhQUFXLEVBQUUsTUFBTSxLQUFLLFFBQVEsUUFBUSxJQUFJLEdBQUcsWUFBWSxFQUFFLENBQUM7QUFFOUQsUUFBTSxrQkFBa0IsUUFBUSxJQUFJO0FBRXBDLFFBQU0sd0JBQWdDO0FBQUEsSUFDcEMsTUFBTTtBQUFBLElBQ04sZ0JBQWdCLFFBQVE7QUFDdEIsYUFBTyxZQUFZLElBQUkseUJBQXlCLE9BQU8sS0FBSyxLQUFLLFNBQVM7QUFDeEUsWUFBSSxJQUFJLFdBQVcsUUFB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

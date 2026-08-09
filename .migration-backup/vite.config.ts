import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("react-dom")) return "vendor-react-dom";
            if (id.includes("/react/")) return "vendor-react";
            if (id.includes("@radix-ui")) return "vendor-ui";
            if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts";
            if (id.includes("leaflet")) return "vendor-maps";
            if (id.includes("@tanstack")) return "vendor-query";
            if (id.includes("react-hook-form") || id.includes("@hookform")) return "vendor-forms";
            if (id.includes("date-fns")) return "vendor-dates";
            if (id.includes("@stripe")) return "vendor-stripe";
            if (id.includes("@sentry")) return "vendor-sentry";
            if (id.includes("framer-motion")) return "vendor-motion";
            if (id.includes("zod") || id.includes("drizzle-zod")) return "vendor-validation";
            if (id.includes("lucide-react")) return "vendor-icons";
            if (id.includes("cmdk") || id.includes("sonner") || id.includes("vaul")) return "vendor-ui-extras";
          }
        },
      },
    },
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

const apiBackend = process.env.VITE_API_BASE_URL || "http://localhost:8000";

const apiProxy = {
  "/health": { target: apiBackend, changeOrigin: true },
  "/upload": { target: apiBackend, changeOrigin: true },
  "/verify": { target: apiBackend, changeOrigin: true },
  "/analyze-forensics": { target: apiBackend, changeOrigin: true },
  "/analyze": { target: apiBackend, changeOrigin: true },
  "/cases": { target: apiBackend, changeOrigin: true },
  "/auth": { target: apiBackend, changeOrigin: true },
  "/elicit": { target: apiBackend, changeOrigin: true },
  "/escalate": { target: apiBackend, changeOrigin: true },
  "/api": { target: apiBackend, changeOrigin: true },
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: apiProxy,
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
    proxy: apiProxy,
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
});

import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Dev: /api and /ws go to core-api on :3000 (ARCHITECTURE §2). No changeOrigin: core-api's origin
// check compares Origin with the Host the browser used (localhost:5173 or <arch-ip>:5173).
const CORE_API = "http://127.0.0.1:3000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": { target: CORE_API },
      "/ws": { target: CORE_API, ws: true },
    },
  },
});

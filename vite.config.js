import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_GITHUB_PAGES === "true" ? "/grafik/site/" : "/",
  server: { host: "0.0.0.0", proxy: { "/api": "http://127.0.0.1:3001" } },
  preview: { host: "0.0.0.0" },
});

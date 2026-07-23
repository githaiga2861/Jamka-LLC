import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" makes the build work on GitHub Pages sub-paths AND Vercel roots.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: { outDir: "dist" }
});

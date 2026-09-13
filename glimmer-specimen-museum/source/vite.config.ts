import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "VITE_");

  return {
    plugins: [react()],
    // CloudBase shares this environment with an existing site, so its mirror is
    // published below a path prefix rather than replacing the hosting root.
    base: env.VITE_PUBLIC_BASE || "/",
  };
});

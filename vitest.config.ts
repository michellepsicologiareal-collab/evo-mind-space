import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "json-summary", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.{test,spec}.{ts,tsx}",
        "src/test/**",
        "src/integrations/supabase/types.ts",
        "src/vite-env.d.ts",
        "src/main.tsx",
      ],
      // Enforce a floor specifically on the homework actions migration path.
      // Floors on the file that owns the legacy `actions` migration.
      // Values reflect current pure-logic coverage (normalizeActions / serializeActions);
      // raise them as more of the component is tested.
      thresholds: {
        "src/components/app/PatientHomework.tsx": {
          lines: 8,
          statements: 8,
          functions: 10,
          branches: 55,
        },
      },

    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});

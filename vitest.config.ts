import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    exclude: [
      "node_modules/**",
      ".next/**",
      "tests/browser/**",
      "playwright-report/**",
      "test-results/**",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "coverage",
      include: ["app/**", "src/**", "scripts/**"],
      exclude: ["**/*.d.ts"],
    },
  },
});

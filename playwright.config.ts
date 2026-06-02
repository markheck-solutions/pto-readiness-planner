import { defineConfig } from "@playwright/test";

const DEFAULT_BASE_URL = "http://127.0.0.1:3102";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? DEFAULT_BASE_URL;
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === "1";
const useLocalWebServer = !skipWebServer && baseURL === DEFAULT_BASE_URL;

export default defineConfig({
  testDir: "tests/browser",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  use: {
    baseURL,
    headless: true,
    viewport: { width: 1400, height: 900 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: useLocalWebServer
    ? {
        command: "npm run dev",
        url: `${DEFAULT_BASE_URL}/api/health`,
        reuseExistingServer: true,
        timeout: 120_000,
      }
    : undefined,
});

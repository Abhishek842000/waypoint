import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

const recordDemo = Boolean(process.env.RECORD_DEMO);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  testIgnore: recordDemo ? [] : ["**/demo-video.spec.ts"],
  use: {
    baseURL,
    viewport: { width: 1280, height: 720 },
    trace: "retain-on-failure",
    video: recordDemo ? { mode: "on", size: { width: 1280, height: 720 } } : "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: recordDemo ? { slowMo: 220 } : undefined,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_NO_WEBSERVER
    ? undefined
    : {
        command: "pnpm dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        env: {
          ...process.env,
          ESCALATION_DELAY_MULTIPLIER: process.env.ESCALATION_DELAY_MULTIPLIER ?? "0.05",
        },
      },
});

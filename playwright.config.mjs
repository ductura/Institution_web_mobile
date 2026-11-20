import { defineConfig, devices } from "@playwright/test";

// e2e against a production build of this app and the fake Institution_server
// (tests/e2e/lazni-server.mjs). Ports differ from dev so both can run.
const LAZNI = 4099;
const APP = 5175;

export default defineConfig({
  testDir: "tests/e2e",
  retries: process.env.CI ? 1 : 0,
  // Svi uređaji pišu u isti demo dokument lažnog poslužitelja, pa se izvode jedan za drugim.
  workers: 1,
  reporter: "list",
  use: { baseURL: `http://127.0.0.1:${APP}`, trace: "retain-on-failure" },
  webServer: [
    {
      command: "node tests/e2e/lazni-server.mjs",
      env: { LAZNI_PORT: String(LAZNI) },
      url: `http://127.0.0.1:${LAZNI}/__zdravlje`,
      reuseExistingServer: false,
    },
    {
      command: `pnpm build && pnpm exec next start -H 127.0.0.1 -p ${APP}`,
      env: { INSTITUTION_SERVER_URL: `http://127.0.0.1:${LAZNI}`, NEXT_TELEMETRY_DISABLED: "1" },
      url: `http://127.0.0.1:${APP}/`,
      timeout: 240_000,
      reuseExistingServer: false,
    },
  ],
  projects: [
    { name: "android-phone", use: { ...devices["Pixel 7"] } },
    { name: "iphone", use: { ...devices["iPhone 14"] } },
    { name: "ipad", use: { ...devices["iPad (gen 7)"] } },
  ],
});

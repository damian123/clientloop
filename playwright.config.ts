import { defineConfig, devices } from "@playwright/test";
import { seedUserId } from "@clientloop/domain";

const apiPort = 4100;
const webPort = 3100;

export default defineConfig({
  testDir: "./apps/web/e2e",
  timeout: 30_000,
  expect: {
    timeout: 10_000
  },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://127.0.0.1:${webPort}`,
    trace: "on-first-retry"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  webServer: [
    {
      command: `API_PORT=${apiPort} API_HOST=127.0.0.1 CRM_REPOSITORY=memory npm run start -w @clientloop/api`,
      url: `http://127.0.0.1:${apiPort}/v1/dashboard`,
      reuseExistingServer: !process.env.CI,
      timeout: 20_000
    },
    {
      command: `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:${apiPort} NEXT_PUBLIC_DEV_LOGIN_USER_ID=${seedUserId} npm run dev -w @clientloop/web -- -p ${webPort} -H 127.0.0.1`,
      url: `http://127.0.0.1:${webPort}`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000
    }
  ]
});

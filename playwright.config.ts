import { defineConfig, devices } from '@playwright/test';

// E2E runs against a real backend + Vite, both started below. The backend uses
// an isolated demo DB (DATABASE_PATH) seeded with admin/manager/sub/user1
// (password "password"), so tests never touch the dev database.
const FRONTEND = 'http://localhost:5173';
const API = 'http://localhost:3001';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // shared backend DB — keep specs serial for determinism
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: FRONTEND,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    {
      command: 'yarn server',
      url: `${API}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        PORT: '3001',
        NODE_ENV: 'development',
        SEED_DEMO_DATA: 'true',
        DATABASE_PATH: './data/e2e-scheduler.db',
        FRONTEND_URL: FRONTEND,
      },
    },
    {
      command: 'yarn dev --port 5173',
      url: FRONTEND,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});

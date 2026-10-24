import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  use: { baseURL: 'http://127.0.0.1:5274', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5274',
    reuseExistingServer: false,
    env: {
      NODE_ENV: 'development',
      APP_BASE_URL: 'http://127.0.0.1:5274',
      API_BASE_URL: 'http://127.0.0.1:8878',
      LOG_LEVEL: 'silent',
    },
    timeout: 30_000,
  },
});

import { defineConfig, devices } from '@playwright/test';
const ci = !!process.env.CI;
const production = !!process.env.PRODUCTION_PREVIEW;
const baseURL = production ? 'http://127.0.0.1:5174' : 'http://127.0.0.1:5173';
export default defineConfig({
  testDir: './tests',
  timeout: 60000,
  expect: { timeout: 20000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
    launchOptions: process.platform === 'win32' ? { channel: 'chrome' } : {},
  },
  webServer: [
    {
      command: `${process.platform === 'win32' ? '..\\.venv\\Scripts\\python.exe' : 'python'} -m uvicorn app.main:app --host 127.0.0.1 --port 8000`,
      cwd: '../api',
      url: 'http://127.0.0.1:8000/api/health',
      reuseExistingServer: !ci,
      timeout: 120000,
    },
    {
      command: production ? 'npm run preview' : 'npm run dev',
      url: baseURL,
      reuseExistingServer: !ci,
      timeout: 60000,
    },
  ],
});

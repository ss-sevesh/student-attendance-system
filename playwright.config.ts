import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const origin = 'http://127.0.0.1:3100';
const databasePath = join(tmpdir(), 'student-browser-acceptance.sqlite');

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: origin,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
    { name: 'mobile-chromium', use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true } },
  ],
  webServer: process.env.E2E_EXTERNAL_SERVER ? undefined : {
    command: 'node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3100',
    url: origin,
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      DATABASE_PATH: databasePath,
      APP_ORIGIN: origin,
    },
  },
});

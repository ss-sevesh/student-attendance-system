import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const origin = 'http://127.0.0.1:3105';
const databasePath = process.env.ADMIN_E2E_DB_PATH ?? join(tmpdir(), `student-admin-${randomUUID()}.sqlite`);
process.env.ADMIN_E2E_DB_PATH = databasePath;

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'attendance-admin.spec.ts',
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['./tests/e2e/admin-reporter.cjs']],
  use: { baseURL: origin, trace: 'off', screenshot: 'off', video: 'off' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
    { name: 'mobile-chromium', use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true } },
  ],
  webServer: process.env.E2E_EXTERNAL_SERVER ? undefined : {
    command: 'node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3105',
    url: origin,
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      DATABASE_PATH: databasePath,
      APP_ORIGIN: origin,
      ADMIN_EMAIL: 'browser-admin@example.com',
    },
  },
});

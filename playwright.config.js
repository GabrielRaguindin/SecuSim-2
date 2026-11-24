import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
// 127.0.0.1 rather than localhost: on some CI runners localhost resolves to IPv6 first and is refused.
const ORIGIN = `http://127.0.0.1:${PORT}`;
const CI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  workers: CI ? 2 : undefined,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: ORIGIN,
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    // The app's springs, sheets and glide are timing hazards. Reduced motion keeps every state
    // change and drops the movement. A spec that needs real motion opts back in with
    // test.use({ reducedMotion: 'no-preference' }).
    reducedMotion: 'reduce',
    trace: CI ? 'on-first-retry' : 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: CI ? 'retain-on-failure' : 'off',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    // On CI the workflow builds in its own step, so the build is not counted against the start-up timeout.
    command: CI
      ? `npx next start -H 127.0.0.1 -p ${PORT}`
      : `npx next build && npx next start -H 127.0.0.1 -p ${PORT}`,
    url: ORIGIN,
    // Locally an already-running server on 3100 is reused. If it is a stale build, stop it first.
    reuseExistingServer: !CI,
    timeout: 180_000,
    env: { NEXT_TELEMETRY_DISABLED: '1' },
  },
});
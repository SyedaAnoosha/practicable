import { defineConfig, devices } from '@playwright/test'

// Chromium only — the gating suite and the axe sweep need one real browser exercising
// the real token path, not cross-browser coverage.
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // the gating suite shares seeded fixtures; parallel runs would race them
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // Boots the real Vite dev server so Playwright hits the actual SPA build, not a mock —
  // gating case 9 (view-source on an unentitled lesson) only means anything against real
  // client output. CI must start the FastAPI backend itself before this config exists to
  // hand off to (see .github/workflows/ci.yml).
  webServer: process.env.CI
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:5173',
        reuseExistingServer: true,
        timeout: 60_000,
      },
})

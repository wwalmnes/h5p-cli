import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import os from 'os';

export const H5P_CLI = path.resolve('./h5p.js');
export const SMOKE_DIR = path.join(os.tmpdir(), 'h5p-cli-smoke');

export default defineConfig({
  testDir: './tests/smoke',
  globalSetup: './tests/smoke/global-setup.ts',
  use: {
    baseURL: 'http://localhost:8080',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `cd "${SMOKE_DIR}" && node "${H5P_CLI}" server`,
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});

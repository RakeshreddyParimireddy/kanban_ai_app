import os from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

// Starts its own backend on port 8001 serving the built frontend (`out/`) with a throwaway
// database, so e2e runs never touch the real board in backend/data. Run `npm run build` first
// (`npm run test:e2e` does). One worker: all tests share the same user's board.
const port = 8001;

export default defineConfig({
  testDir: "./tests",
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `uv run uvicorn app.main:app --host 127.0.0.1 --port ${port}`,
    cwd: path.resolve(__dirname, "../backend"),
    url: `http://127.0.0.1:${port}/api/health`,
    reuseExistingServer: false,
    env: {
      STATIC_DIR: path.resolve(__dirname, "out"),
      DB_PATH: path.join(os.tmpdir(), "pm-e2e", "app.db"),
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

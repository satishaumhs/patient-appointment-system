const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  fullyParallel: false, // both specs share one isolated backend+DB pair -- see webServer below
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // This app has no explicit timeZone in its own browser-side time
    // formatting (e.g. BookAppointment.jsx's slot-time labels) -- it
    // renders in whatever timezone the browser itself is in, same as a
    // real patient/doctor's own browser would. Pinning it to the clinic's
    // own timezone here is what makes specs asserting on a specific
    // formatted time label (e.g. "09:00 AM") deterministic regardless of
    // which OS/timezone actually runs the suite, rather than only working
    // by coincidence on a host that already happens to be IST.
    timezoneId: "Asia/Kolkata",
  },
  // PLAYWRIGHT_CHANNEL is unset in CI and on a normal dev machine, so this
  // defaults to Playwright's own downloaded Chromium build. It exists for
  // hosts like this project's own local dev machine, where a freshly
  // downloaded/unsigned browser binary fails to spawn at all (confirmed via
  // direct child_process.spawn, independent of Playwright) -- there, run
  // with PLAYWRIGHT_CHANNEL=msedge to drive the already-installed, signed
  // system Edge instead. Both are Chromium-based and drive identically
  // through Playwright's protocol.
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], channel: process.env.PLAYWRIGHT_CHANNEL || undefined } },
  ],
  // Starts the real app, not a mock -- e2e-server.js is the one piece that
  // isn't "the real app" verbatim: it points the real Express server at a
  // throwaway MongoMemoryServer instead of server/.env's shared Atlas
  // cluster, so a full Playwright run can never touch real dev/prod data.
  webServer: [
    {
      // Generous timeout: a cold CI runner's first-ever launch has to
      // download mongodb-memory-server's real MongoDB binary (tens of MB)
      // before the server can even start connecting.
      command: "node e2e-server.js",
      cwd: "../server",
      port: 5000,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "npm run dev -- --port 5173 --strictPort",
      cwd: "../client",
      port: 5173,
      timeout: 60_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});

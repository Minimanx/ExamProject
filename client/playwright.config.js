import { defineConfig, devices } from "@playwright/test";

const API_PORT = 5055;
const CLIENT_PORT = 8123;

export default defineConfig({
    testDir: "./e2e",
    // The suite drives one shared world (theaters, a signed-up user, socket
    // state), so tests are ordered and serial rather than parallel.
    fullyParallel: false,
    workers: 1,
    timeout: 30000,
    expect: { timeout: 10000 },
    reporter: process.env.CI ? "list" : [["list"]],
    use: {
        baseURL: `http://localhost:${CLIENT_PORT}`,
        trace: "retain-on-failure",
    },
    projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
    webServer: [
        {
            command: `node ../server/test-server.mjs`,
            env: { PORT: String(API_PORT), CLIENT_ORIGINS: `http://localhost:${CLIENT_PORT}` },
            url: `http://localhost:${API_PORT}/health`,
            reuseExistingServer: !process.env.CI,
            timeout: 120000,
        },
        {
            // Serving only. The build happens in the `test:e2e` script, NOT
            // here: reuseExistingServer skips this command when a server is
            // already running, so a build placed here is silently skipped and
            // the suite tests a stale bundle.
            // --dev disables sirv's caching; without it a half-written bundle
            // gets served and presents as "Unexpected end of input".
            command: `npx sirv public --single --dev --port ${CLIENT_PORT}`,
            url: `http://localhost:${CLIENT_PORT}`,
            reuseExistingServer: !process.env.CI,
            timeout: 120000,
        },
    ],
});

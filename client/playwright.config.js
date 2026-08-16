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
    projects: [
        {
            name: "chromium",
            use: {
                ...devices["Desktop Chrome"],
                // The voice tests need a microphone and a peer connection. The
                // fake device gives a real MediaStream with a generated tone,
                // and the fake ui answers the permission prompt — without both,
                // getUserMedia hangs waiting for a click nothing will make.
                launchOptions: {
                    args: [
                        "--use-fake-device-for-media-stream",
                        "--use-fake-ui-for-media-stream",
                        "--autoplay-policy=no-user-gesture-required",
                    ],
                },
                permissions: ["microphone"],
            },
        },
    ],
    webServer: [
        {
            command: `node ../server/test-server.mjs`,
            env: { PORT: String(API_PORT), CLIENT_ORIGINS: `http://localhost:${CLIENT_PORT}` },
            url: `http://localhost:${API_PORT}/health`,
            reuseExistingServer: !process.env.CI,
            timeout: 120000,
        },
        {
            // Build then preview. `vite preview` serves the adapter-static
            // output with the SPA fallback, replacing sirv.
            command: `npm run build && npm run preview -- --port ${CLIENT_PORT} --strictPort`,
            env: { PUBLIC_API_URL: `http://localhost:${API_PORT}` },
            url: `http://localhost:${CLIENT_PORT}`,
            reuseExistingServer: !process.env.CI,
            timeout: 120000,
        },
    ],
});

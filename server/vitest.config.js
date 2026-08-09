import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        include: ["test/**/*.test.js"],
        globalSetup: ["./test/globalSetup.js"],
        setupFiles: ["./test/setup.js"],
        // All test files share one mongod and one "FlixDrive" database,
        // so they must not run concurrently.
        fileParallelism: false,
        testTimeout: 20000,
        hookTimeout: 60000,
    },
});

import { sveltekit } from "@sveltejs/kit/vite";

export default {
    plugins: [sveltekit()],
    test: {
        // Scoped to src/: e2e/ holds Playwright specs, which use the same
        // `.test.js`-adjacent naming and fail immediately under Vitest.
        include: ["src/**/*.test.js"],
    },
};

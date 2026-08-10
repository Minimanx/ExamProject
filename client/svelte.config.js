import adapter from "@sveltejs/adapter-vercel";

export default {
    kit: {
        // Vercel's own SvelteKit preset expects this adapter's output shape, so
        // deploying needs no dashboard configuration beyond Root Directory.
        //
        // The runtime is pinned rather than inferred: the adapter otherwise
        // derives it from whatever Node is doing the build, which fails on any
        // version Vercel does not offer. Pinning matches engines.node and makes
        // the build independent of who runs it.
        adapter: adapter({ runtime: "nodejs24.x" }),
    },
};

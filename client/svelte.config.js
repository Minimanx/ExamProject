import adapter from "@sveltejs/adapter-static";

export default {
    kit: {
        // SPA fallback: every path serves the same shell and the client router
        // takes over — exactly what Rollup + `sirv --single` did before.
        adapter: adapter({ fallback: "index.html", strict: false }),
    },
};

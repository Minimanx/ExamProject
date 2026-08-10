import { server } from "./app.js";
import { mongoClientPromise } from "./database/createConnection.js";

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log("Server running on port: ", PORT);
});

/**
 * Drain rather than drop. Without this the process died the instant the
 * platform sent SIGTERM, cutting in-flight requests and leaving the Mongo
 * connection to time out server-side. See defect O4.
 */
let shuttingDown = false;

async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Received ${signal}, shutting down`);

    const forced = setTimeout(() => {
        console.error("Shutdown timed out, exiting anyway");
        process.exit(1);
    }, 10000);
    forced.unref();

    try {
        await new Promise((resolve) => server.close(resolve));
        const client = await mongoClientPromise;
        await client.close();
        console.log("Shutdown complete");
        process.exit(0);
    } catch (error) {
        console.error("Shutdown failed", { message: error.message });
        process.exit(1);
    }
}

for (const signal of ["SIGTERM", "SIGINT"]) {
    process.on(signal, () => shutdown(signal));
}

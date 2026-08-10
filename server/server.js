import { server } from "./app.js";
import { mongoClientPromise } from "./database/createConnection.js";
import { logger } from "./logger.js";

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    logger.info({ port: PORT }, "Server listening");
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
    logger.info({ signal }, "Shutting down");

    const forced = setTimeout(() => {
        logger.error("Shutdown timed out, exiting anyway");
        process.exit(1);
    }, 10000);
    forced.unref();

    try {
        await new Promise((resolve) => server.close(resolve));
        const client = await mongoClientPromise;
        await client.close();
        logger.info("Shutdown complete");
        process.exit(0);
    } catch (error) {
        logger.error({ err: error }, "Shutdown failed");
        process.exit(1);
    }
}

for (const signal of ["SIGTERM", "SIGINT"]) {
    process.on(signal, () => shutdown(signal));
}

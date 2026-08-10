/**
 * Readiness of the one dependency the server cannot work without.
 *
 * Every route reads or writes Mongo, and sessions live there too, so an
 * instance that has lost the database can serve nothing useful. /health used to
 * answer 200 for as long as the process was alive, which told a load balancer
 * only that Node had not crashed. See defect O4.
 */

export const MONGO_PING_TIMEOUT_MS = 2000;

export async function checkMongoHealth(client, timeoutMs = MONGO_PING_TIMEOUT_MS) {
    let timer;
    // The driver's own serverSelectionTimeoutMS defaults to 30 seconds. A
    // health check that takes that long has already failed as far as any load
    // balancer is concerned, so the ping gets its own, much shorter, deadline.
    const deadline = new Promise((resolve) => {
        timer = setTimeout(() => resolve(false), timeoutMs);
        timer.unref?.();
    });

    try {
        // Called inside the try because a destroyed pool throws synchronously
        // from db() rather than rejecting.
        const ping = Promise.resolve(client.db().admin().ping()).then(() => true);
        return await Promise.race([ping, deadline]);
    } catch {
        return false;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Boot-time configuration validation.
 *
 * Required settings used to be checked ad hoc in three files, so a missing one
 * surfaced as an obscure failure at whichever request first needed it — a
 * missing OMDB key only showed up when someone tried to create an event. This
 * collects the rules in one place and reports every problem at once.
 */

const MINIMUM_SECRET_LENGTH = 32;

export function validateConfig(env = process.env) {
    const problems = [];
    const warnings = [];
    const isProduction = env.NODE_ENV === "production";

    if (!env.MONGODB_URI) {
        problems.push("MONGODB_URI is required");
    }

    if (!env.SESSION_SECRET) {
        problems.push("SESSION_SECRET is required");
    } else if (env.SESSION_SECRET.length < MINIMUM_SECRET_LENGTH) {
        problems.push(
            `SESSION_SECRET must be at least ${MINIMUM_SECRET_LENGTH} characters, got ${env.SESSION_SECRET.length}`
        );
    }

    // Without an explicit allow-list the CORS and CSRF checks fall back to
    // localhost, which would reject the real client in production.
    if (isProduction && !env.CLIENT_ORIGINS) {
        problems.push("CLIENT_ORIGINS is required in production");
    }

    // Optional integrations degrade to a clear error at the point of use rather
    // than preventing the app from starting.
    if (!env.OMDB_API_KEY) {
        warnings.push("OMDB_API_KEY is not set — movie search and event creation will fail");
    }
    if (!env.EMAIL_USER || !env.EMAIL_PASSWORD) {
        warnings.push(
            "EMAIL_USER/EMAIL_PASSWORD are not set — password reset emails will not send"
        );
    }

    // The server served the client from client/public when this was "true". The
    // SvelteKit migration deleted that directory, and adapter-vercel emits no
    // index.html to point at, so the branch was removed rather than repointed.
    if (env.SERVE_CLIENT === "true") {
        warnings.push(
            "SERVE_CLIENT=true is no longer supported — the server serves the API only, and the client is deployed separately"
        );
    }

    if (problems.length > 0) {
        throw new Error(`Invalid configuration:\n  - ${problems.join("\n  - ")}`);
    }

    return { warnings };
}

/**
 * One shape for every error response.
 *
 * Every failure used to be a 400 with a bare `{ message }`, whatever had gone
 * wrong: a malformed body, a missing session, a non-owner trying to delete
 * someone else's theater. A client could not tell "your input is wrong, fix it
 * and retry" from "log in first" from "you are not allowed", and the same
 * condition answered 404 on GET and 400 on PATCH.
 *
 * Responses now carry a stable machine-readable `code` alongside the human
 * `message` the UI already shows, and the status reflects what actually
 * happened.
 */

export const codes = {
    // The request itself is malformed or fails validation.
    VALIDATION_FAILED: 400,
    // No usable session — log in, then retry.
    UNAUTHENTICATED: 401,
    // Logged in, but not permitted to do this.
    FORBIDDEN: 403,
    // The thing addressed does not exist.
    NOT_FOUND: 404,
    // Well-formed and permitted, but conflicts with current state.
    CONFLICT: 400,
    // An upstream the server depends on failed.
    UPSTREAM_UNAVAILABLE: 502,
    // A dependency this server needs is not configured or not reachable.
    UNAVAILABLE: 503,
    INTERNAL: 500,
};

/**
 * `CONFLICT` maps to 400 rather than 409 deliberately. 409 is the more accurate
 * code for "you already have an ongoing event" and "theater is full", but the
 * roadmap's Phase 2 asks for 401/403 on auth failures specifically, and moving
 * conflicts too would change responses the client already handles for no gain
 * this phase. The code is distinct now, so the status can follow later without
 * touching call sites.
 */
export function sendError(res, code, message, extra = {}) {
    const status = codes[code];
    if (status === undefined) {
        throw new Error(`Unknown error code: ${code}`);
    }
    res.status(status).send({ message, code, ...extra });
}

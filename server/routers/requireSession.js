import { sendError } from "../errors.js";

/**
 * Refuse a request that has no session.
 *
 * The message differs by route — "Must be logged in to join theater" says more
 * than "Must be logged in" — so it is a parameter rather than a constant. Three
 * routers had their own identical copy of this, which is three places for the
 * status to drift apart.
 */
export const requireSession = (message) => (req, res, next) => {
    if (!req.session.loggedIn) {
        sendError(res, "UNAUTHENTICATED", message);
        return;
    }
    next();
};

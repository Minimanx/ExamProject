/**
 * Whether signing in actually took.
 *
 * A successful login is two separate things: the server accepting the password,
 * and the browser keeping the cookie that stands for the session afterwards. The
 * client only checked the first. It stored the account in localStorage, rendered
 * the world, and every request after that went out with no session — so the
 * first thing anyone tried to do answered "Must be logged in to join theater"
 * for someone who had just watched their own login succeed.
 *
 * A browser drops that cookie whenever it treats the API as a third party: the
 * page and the API are separate origins, so a private window — which blocks
 * third-party cookies by default, as Safari does all the time — keeps nothing.
 * Nothing in the login response says so. The only way to know is to ask the
 * server who it thinks we are, with the cookie we hope it kept.
 *
 * Three answers, not two. A network blip is not evidence that the session
 * failed, and refusing to sign someone in over one is worse than the problem.
 */
export async function sessionSurvives(apiFetch) {
    let response;
    try {
        response = await apiFetch("/me");
    } catch {
        return "unknown";
    }

    if (response.ok) return "yes";
    if (response.status === 401) return "no";
    return "unknown";
}

/** What to tell someone whose sign-in did not survive the round trip. */
export const COOKIE_BLOCKED_MESSAGE =
    "Signed in, but your browser did not keep the session cookie, so the server will not recognise you. Private windows block these by default — try an ordinary window.";

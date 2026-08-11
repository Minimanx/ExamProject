/**
 * The world cannot be server-rendered, and this is the group that holds it.
 *
 * `InteractiveSpace` and `InsideTheater` open a socket at component-init scope,
 * `userStore` reads localStorage at module scope, and the stage layout measures
 * the viewport before it can draw. None of that has a server equivalent.
 *
 * This sits on the group rather than on the app, so a route outside it — a
 * public club page, which is a read-only view of data the server already has —
 * can render on the server, which is what Phase 5 needed SSR for.
 */
export const ssr = false;
export const prerender = false;

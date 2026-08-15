import { PUBLIC_API_URL } from "$env/static/public";

/**
 * The directory renders on the server, for the same reason a club page does: it
 * is a public page meant to be linked to and found, and one that needs
 * JavaScript before it says anything is worth nothing to whatever fetches it
 * first.
 */
export const ssr = true;

export async function load({ fetch }) {
    const base = (PUBLIC_API_URL || "").replace(/\/$/, "");
    const response = await fetch(`${base}/clubs`);

    if (!response.ok) {
        // A directory that cannot load is an empty directory with an
        // explanation, not an error page — the rest of the site still works.
        return { clubs: [], failed: true };
    }

    const { data } = await response.json();
    return { clubs: data, failed: false };
}

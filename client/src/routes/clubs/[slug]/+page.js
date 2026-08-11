import { error } from "@sveltejs/kit";
import { PUBLIC_API_URL } from "$env/static/public";

/**
 * A public club page renders on the server.
 *
 * This is the first route that can. The world cannot — it opens a socket at
 * component-init scope and measures the viewport before it can draw — which is
 * why SSR is off for the (app) group and on here. A link to a club is meant to
 * be shared, so it has to be worth something to whatever fetches it first.
 */
export const ssr = true;

export async function load({ params, fetch }) {
    const base = (PUBLIC_API_URL || "").replace(/\/$/, "");
    const response = await fetch(`${base}/clubs/${params.slug}`);

    if (!response.ok) {
        // The API answers 404 for a private club as well as a missing one, on
        // purpose: distinguishing them would confirm the club exists.
        error(response.status === 404 ? 404 : 500, "That club could not be found");
    }

    const { data } = await response.json();
    return { club: data };
}

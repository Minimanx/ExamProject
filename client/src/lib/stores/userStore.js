import { writable } from "svelte/store";
import { browser } from "$app/environment";

// Guarded because the module is evaluated during the build even with ssr=false.
const stored = browser ? localStorage.getItem("user") : null;

export const user = writable(stored ? JSON.parse(stored) : { loggedIn: false });

if (browser) {
    user.subscribe((value) => localStorage.setItem("user", JSON.stringify(value)));
}

/**
 * Ask the server whether the stored session is still real.
 *
 * localStorage outlives the session it describes — a server restart, an expiry,
 * a logout in another tab. Without this the app renders the whole world for
 * somebody the server does not know: driving around, typing into a chat that
 * goes nowhere, invisible to everyone and unable to join anything. It looks
 * completely fine, which is what makes it bad.
 *
 * A network failure is not a logout, so only an explicit refusal clears the
 * session. Being offline for a moment should not throw you out.
 */
export async function reconcileSession(apiFetch) {
    if (!browser) return;

    let response;
    try {
        response = await apiFetch("/me");
    } catch {
        return;
    }

    if (response.status === 401) {
        user.set({ loggedIn: false });
        return;
    }
    if (!response.ok) return;

    const { data } = await response.json();
    // Kept in step with the server rather than trusted from storage: a username
    // could have changed since it was written.
    user.update((current) => ({
        ...current,
        loggedIn: true,
        userID: data._id,
        username: data.username,
    }));
}

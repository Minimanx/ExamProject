import { writable } from "svelte/store";
import { browser } from "$app/environment";

// Guarded because the module is evaluated during the build even with ssr=false.
const stored = browser ? localStorage.getItem("user") : null;

export const user = writable(stored ? JSON.parse(stored) : { loggedIn: false });

if (browser) {
    user.subscribe((value) => localStorage.setItem("user", JSON.stringify(value)));
}

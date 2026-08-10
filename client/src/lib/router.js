import { writable, derived } from "svelte/store";

function read() {
    return { pathname: window.location.pathname, search: window.location.search };
}

export const location = writable(read());

function sync() {
    location.set(read());
}

window.addEventListener("popstate", sync);

export function navigate(to) {
    if (to === window.location.pathname + window.location.search) return;
    window.history.pushState({}, "", to);
    sync();
}

const THEATER = /^\/theaters\/([^/]+)\/?$/;

export const route = derived(location, ($location) => {
    const match = THEATER.exec($location.pathname);
    return match ? { name: "theater", params: { id: match[1] } } : { name: "world", params: {} };
});

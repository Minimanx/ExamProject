import io from "socket.io-client";

import { PUBLIC_API_URL } from "$env/static/public";

const configuredApiUrl = PUBLIC_API_URL;
let sharedSocket;

export const apiUrl = (configuredApiUrl || "").replace(/\/$/, "");

export function apiFetch(path, options = {}) {
    return fetch(`${apiUrl}${path}`, {
        ...options,
        credentials: "include",
    });
}

export function createSocket() {
    if(!sharedSocket) {
        sharedSocket = io(apiUrl || undefined, { withCredentials: true });
    }

    return sharedSocket;
}

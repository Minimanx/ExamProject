import io from "socket.io-client";

const configuredApiUrl = process.env.API_URL;
let sharedSocket;

export const apiUrl = configuredApiUrl.replace(/\/$/, "");

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

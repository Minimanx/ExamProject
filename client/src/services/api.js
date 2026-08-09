import io from "socket.io-client";

const configuredApiUrl = process.env.API_URL;

export const apiUrl = configuredApiUrl.replace(/\/$/, "");

export function apiFetch(path, options = {}) {
    return fetch(`${apiUrl}${path}`, {
        ...options,
        credentials: "include",
    });
}

export function createSocket() {
    return io(apiUrl || undefined, { withCredentials: true });
}

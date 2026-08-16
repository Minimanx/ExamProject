/**
 * The ICE servers a peer connection needs to find a route to another peer.
 *
 * Handed out by the server rather than built into the client bundle, because
 * TURN credentials are credentials: TURN relays media for whoever presents
 * them, and a relay is the one recurring cost in this design. Shipping them in
 * the client would publish them to everyone who opens the page, including people
 * who never intended to join a call.
 *
 * STUN alone is enough for most pairs — it only tells a peer its own public
 * address so the two can connect directly. TURN is for the pairs that cannot,
 * which is roughly the symmetric-NAT and restrictive-firewall cases: without it,
 * those calls simply never connect, and the failure looks like silence rather
 * than an error.
 */

const DEFAULT_STUN = "stun:stun.l.google.com:19302";

export function iceServers(env = process.env) {
    const servers = [
        {
            urls: (env.STUN_URLS ?? DEFAULT_STUN)
                .split(",")
                .map((url) => url.trim())
                .filter(Boolean),
        },
    ];

    // All three or none: a TURN url without credentials is a server that will
    // refuse every allocation, which fails later and less clearly than not
    // offering it at all.
    if (env.TURN_URL && env.TURN_USERNAME && env.TURN_CREDENTIAL) {
        servers.push({
            urls: env.TURN_URL.split(",")
                .map((url) => url.trim())
                .filter(Boolean),
            username: env.TURN_USERNAME,
            credential: env.TURN_CREDENTIAL,
        });
    }

    return servers;
}

export function turnConfigured(env = process.env) {
    return Boolean(env.TURN_URL && env.TURN_USERNAME && env.TURN_CREDENTIAL);
}

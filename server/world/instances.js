/**
 * Which hub instance a player is in.
 *
 * Only one instance will exist for a long time, and at that scale this changes
 * nothing observable — which is the point. The roadmap's Phase 11 shards the hub
 * when concurrency demands it, and its stated mitigation for being the largest
 * technical risk is that this groundwork makes that configuration rather than a
 * rewrite. The seam has to exist and be exercised before it is needed, or it
 * will not be there when it is.
 *
 * Everything is keyed on a socket id, which the server owns. Nothing here reads
 * an instance the client claims to be in.
 */

export class HubInstances {
    #capacity;
    #members = new Map();
    #instanceOfSocket = new Map();

    constructor({ capacity }) {
        this.#capacity = capacity;
        this.#members.set("hub-0", new Set());
    }

    /**
     * Place a socket in an instance with room, or refuse.
     *
     * The caller has to handle a refusal now, while the answer is always "the
     * world is full", so that Phase 11 can change the answer to "here is
     * another instance" without changing any caller.
     */
    join(socketId) {
        const existing = this.#instanceOfSocket.get(socketId);
        if (existing !== undefined) {
            // A reconnect racing a disconnect joins twice. Counting it twice
            // would slowly fill the world with people who are not in it.
            return { instanceId: existing };
        }

        for (const [instanceId, members] of this.#members) {
            if (members.size < this.#capacity) {
                members.add(socketId);
                this.#instanceOfSocket.set(socketId, instanceId);
                return { instanceId };
            }
        }

        return { instanceId: null, reason: "The world is full" };
    }

    leave(socketId) {
        const instanceId = this.#instanceOfSocket.get(socketId);
        if (instanceId === undefined) {
            return;
        }

        this.#members.get(instanceId)?.delete(socketId);
        this.#instanceOfSocket.delete(socketId);
    }

    instanceOf(socketId) {
        return this.#instanceOfSocket.get(socketId) ?? null;
    }

    occupancy(instanceId) {
        return this.#members.get(instanceId)?.size ?? 0;
    }
}

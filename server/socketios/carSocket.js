import { HubInstances } from "../world/instances.js";
import { limits } from "../limits.js";
const POSITION_THROTTLE_MS = 50;

/**
 * Every world event addresses one hub instance rather than every connection.
 *
 * Only one instance exists today, so this changes nothing observable — which is
 * the point. Phase 11 shards the hub when concurrency demands it, and the
 * roadmap's mitigation for that being its largest technical risk is that this
 * groundwork makes it configuration. A seam that is never exercised is not
 * there when it is needed.
 */
const hub = new HubInstances({ capacity: limits.hubCapacity });

/** The instance room this socket is in, or null if it never joined one. */
function instanceRoom(socket) {
    const instanceId = socket.data.instanceId;
    return instanceId && socket.rooms.has(instanceId) ? instanceId : null;
}

/**
 * How far a speech bubble carries, in world pixels.
 *
 * A theater lot is 400 wide, so this is roughly "the lot you are standing at and
 * its neighbours" — near enough to have plausibly heard someone.
 */
export const PROXIMITY_RADIUS = 450;

// The same limits as theater chat, for the same reason: nothing else bounds what
// a modified client can push into everyone's view. See defect S7.
const MAX_MESSAGE_LENGTH = 200;
const MESSAGE_WINDOW_MS = 10000;
const MAX_MESSAGES_PER_WINDOW = 10;

/**
 * Where a car is in the world.
 *
 * The client reports a screen-space x and the scroll offset separately, because
 * that is what it needs to draw. Their sum is the only thing comparable between
 * two players looking at different parts of the strip.
 */
function worldPosition({ coords, screen }) {
    if (typeof coords?.x !== "number" || typeof coords?.y !== "number") return null;
    if (!Number.isFinite(coords.x) || !Number.isFinite(coords.y)) return null;

    const scroll = Number.isFinite(screen) ? screen : 0;
    return { x: coords.x + scroll, y: coords.y };
}

function withinEarshot(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y) <= PROXIMITY_RADIUS;
}

/** Car events are only meaningful from a logged-in player. See defect S4. */
function isAuthenticated(socket) {
    return socket.request.session?.loggedIn === true;
}

/**
 * Re-read the session from the store, then answer the same question.
 *
 * A socket's session is captured once, at handshake. Logging in happens over
 * HTTP afterwards, so a socket opened before that keeps a signed-out session
 * until something refreshes it — which made whether the world saw you depend on
 * a reconnect winning a race with the login response. `chatSocket` already
 * reloads for exactly this reason.
 *
 * Only worth doing on join: it hits the session store, and `carPosition` fires
 * many times a second.
 */
function refreshAndCheck(socket) {
    return new Promise((resolve) => {
        if (isAuthenticated(socket)) {
            resolve(true);
            return;
        }
        socket.request.session.reload(() => resolve(isAuthenticated(socket)));
    });
}

const socket = (io) => {
    io.on("connection", (socket) => {
        let lastPositionBroadcast = 0;

        // `socket.id` is always the server's own view of the connection. The
        // client used to supply an `id` which was echoed to everyone, letting a
        // player move or impersonate another player's car. See defect S3.
        socket.on("carPosition", ({ coords, direction, screen }) => {
            if (!isAuthenticated(socket)) return;

            // Remembered so the server can decide who is close enough to hear a
            // speech bubble. Deciding that in the client would mean sending
            // every message to everyone and asking each client to discard what
            // it should not see, which is a rendering convention rather than a
            // range limit — a modified client simply keeps them.
            const position = worldPosition({ coords, screen });
            if (position !== null) {
                socket.data.worldPosition = position;
            }

            const now = Date.now();
            if (now - lastPositionBroadcast < POSITION_THROTTLE_MS) return;
            lastPositionBroadcast = now;

            const room = instanceRoom(socket);
            if (room === null) return;
            socket.to(room).emit("newCarPosition", { id: socket.id, coords, direction, screen });
        });

        socket.on("hubMessage", async ({ text } = {}) => {
            if (!isAuthenticated(socket)) return;
            if (typeof text !== "string") return;

            const message = text.trim();
            if (!message || message.length > MAX_MESSAGE_LENGTH) return;

            const speakerAt = socket.data.worldPosition;
            // Someone who has never reported a position has no distance to
            // anyone. Treating that as the origin would put them beside every
            // player parked near it.
            if (!speakerAt) return;

            const now = Date.now();
            socket.data.hubMessageTimes = (socket.data.hubMessageTimes ?? []).filter(
                (at) => now - at < MESSAGE_WINDOW_MS
            );
            if (socket.data.hubMessageTimes.length >= MAX_MESSAGES_PER_WINDOW) return;
            socket.data.hubMessageTimes.push(now);

            const payload = {
                id: socket.id,
                username: socket.request.session.username,
                text: message,
            };

            // The speaker is included: otherwise you cannot tell whether what
            // you said went out at all.
            for (const listener of await io.fetchSockets()) {
                const listenerAt = listener.data.worldPosition;
                if (listenerAt && withinEarshot(speakerAt, listenerAt)) {
                    listener.emit("newHubMessage", payload);
                }
            }
        });

        socket.on("carJoined", async ({ coords, color, name, screen }) => {
            if (!(await refreshAndCheck(socket))) return;

            const { instanceId, reason } = hub.join(socket.id);
            if (instanceId === null) {
                socket.emit("hubFull", { message: reason });
                return;
            }
            socket.data.instanceId = instanceId;
            socket.join(instanceId);
            socket.emit("hubAssigned", { instanceId });

            // The spawn position counts. Recording only on movement would leave
            // two people who have just arrived unable to hear each other, which
            // is exactly when they would want to talk.
            const position = worldPosition({ coords, screen });
            if (position !== null) {
                socket.data.worldPosition = position;
            }

            socket
                .to(instanceId)
                .emit("newCarJoined", { id: socket.id, color, coords, name, screen });
        });

        socket.on("carUpdate", ({ name, color }) => {
            if (!isAuthenticated(socket)) return;
            const room = instanceRoom(socket);
            if (room === null) return;
            socket.to(room).emit("newCarUpdate", { id: socket.id, name, color });
        });

        socket.on("colorChanged", ({ color }) => {
            if (!isAuthenticated(socket)) return;
            const room = instanceRoom(socket);
            if (room === null) return;
            socket.to(room).emit("newColorChanged", { id: socket.id, color });
        });

        socket.on("theaterAdded", () => {
            if (!isAuthenticated(socket)) return;
            io.emit("newTheaterAdded");
        });

        socket.on("joinedTheater", () => {
            if (!isAuthenticated(socket)) return;

            const room = instanceRoom(socket);
            if (room === null) return;

            // Walking into a theater leaves the hub: the car is gone from the
            // world until they come back out.
            socket.to(room).emit("newJoinedTheater", { id: socket.id });
            socket.to(room).emit("carLeft", { id: socket.id });
            socket.leave(room);
            hub.leave(socket.id);
            delete socket.data.instanceId;
        });

        socket.on("disconnect", () => {
            const room = instanceRoom(socket);
            if (room !== null) {
                socket.to(room).emit("carLeft", { id: socket.id });
            }
            hub.leave(socket.id);
            // The strip is shared by everyone, instanced or not.
            io.emit("newTheaterAdded");
        });
    });
};

export default socket;

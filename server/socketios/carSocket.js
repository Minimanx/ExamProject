import { HubInstances } from "../world/instances.js";
import { acceptMove } from "../world/movement.js";
import { SpatialGrid } from "../world/grid.js";
import { WORLD } from "../world/movement.js";
import { whereIs } from "./presence.js";
import { find as findFriendship, involves } from "../services/friendService.js";
import { limits } from "../limits.js";
import { safeColor } from "../world/colors.js";
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

/**
 * Take a proposed position, keep the one the server believes, answer whether it
 * moved.
 *
 * The client integrates locally so driving stays responsive, and what it sends
 * is a proposal. The server's copy is the position everything else reads —
 * including who is close enough to hear a speech bubble.
 */
function applyProposedPosition(socket, coords, screen) {
    const proposed = worldPosition({ coords, screen });
    if (proposed === null) return false;

    const { accepted, position } = acceptMove(
        socket.data.worldPosition ?? null,
        proposed,
        Date.now()
    );
    socket.data.worldPosition = position;

    if (!accepted) {
        // Told where it really is, rather than left to drift away believing
        // otherwise. A client that never corrects would keep sending refused
        // positions and appear frozen to everyone else.
        socket.emit("positionCorrection", { x: position.x, y: position.y });
    }
    return accepted;
}

/**
 * How far a player can see another player's car.
 *
 * Wider than earshot: you should watch someone drive up before they are close
 * enough to talk to, or cars would appear out of nowhere mid-conversation.
 */
export const INTEREST_RADIUS = 900;

/**
 * Positions of everyone in the world, for answering "who is near whom".
 *
 * One grid rather than one per instance: a socket belongs to exactly one
 * instance and the instance room does the separating, so a second index would be
 * another thing to keep in step for no gain.
 */
const worldGrid = new SpatialGrid({ cellSize: INTEREST_RADIUS });

/**
 * Bring one client's view of the world in line with what it should see.
 *
 * A position update alone is not enough. Someone driving into range has to be
 * announced or their car never appears, and someone driving out has to be
 * removed or their car freezes where it was last seen — a ghost parked where
 * somebody used to be. Those two are what makes interest management look like a
 * bug when they are missing.
 */
function reconcileInterest(io, socket, position) {
    const visible = new Set(worldGrid.near(position, INTEREST_RADIUS, socket.id));
    const previously = socket.data.visibleTo ?? new Set();

    for (const otherId of visible) {
        if (previously.has(otherId)) continue;

        const other = io.sockets.sockets.get(otherId);
        if (!other) continue;

        // Both are told: coming into view is symmetric, and only one of the two
        // is moving.
        socket.emit("newCarJoined", { id: otherId, ...(other.data.car ?? {}) });
        other.emit("newCarJoined", { id: socket.id, ...(socket.data.car ?? {}) });
        other.data.visibleTo?.add(socket.id);
    }

    for (const otherId of previously) {
        if (visible.has(otherId)) continue;

        const other = io.sockets.sockets.get(otherId);
        socket.emit("carLeft", { id: otherId });
        other?.emit("carLeft", { id: socket.id });
        other?.data.visibleTo?.delete(socket.id);
    }

    socket.data.visibleTo = visible;
}

/**
 * Send to everyone who can currently see this player, and nobody else.
 *
 * The instance room is the wrong audience for anything about one car. It is
 * everyone in the hub, most of whom have never been told this car exists — so
 * they discard the message — while the point of interest management is that
 * they are not told in the first place.
 */
function emitToWatchers(io, socket, event, payload) {
    for (const watcherId of socket.data.visibleTo ?? []) {
        io.sockets.sockets.get(watcherId)?.emit(event, payload);
    }
}

/** Take a player out of the world and tell whoever could see them. */
function forgetPlayer(io, socket) {
    for (const watcherId of socket.data.visibleTo ?? []) {
        const other = io.sockets.sockets.get(watcherId);
        other?.emit("carLeft", { id: socket.id });
        other?.data.visibleTo?.delete(socket.id);
    }
    worldGrid.remove(socket.id);
    socket.data.visibleTo = new Set();
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

            // The server decides where this player is. What arrives is a
            // proposal, and a refused one moves nobody — not the player, and not
            // the range calculation that decides who hears their speech bubble.
            if (!applyProposedPosition(socket, coords, screen)) return;

            const now = Date.now();
            if (now - lastPositionBroadcast < POSITION_THROTTLE_MS) return;
            lastPositionBroadcast = now;

            if (instanceRoom(socket) === null) return;

            const at = socket.data.worldPosition;
            worldGrid.place(socket.id, at);
            reconcileInterest(io, socket, at);

            // Only the players who can see this one: the exit criterion for this
            // phase is precisely that a client receives nothing for players it
            // cannot see.
            emitToWatchers(io, socket, "newCarPosition", {
                id: socket.id,
                coords,
                direction,
                screen,
            });
        });

        /**
         * Drive to a friend.
         *
         * Done here rather than by the client, because Phase 4 made the server
         * hold the position and refuse anything it could not have driven to — a
         * teleport is precisely what it rejects. The server performs the move,
         * so its own copy agrees and the joiner can carry on driving from there.
         */
        socket.on("joinFriend", async ({ friendshipId } = {}) => {
            if (!isAuthenticated(socket)) return;
            if (instanceRoom(socket) === null) return;

            const friendship = await findFriendship(friendshipId);
            if (friendship === null || friendship.state !== "accepted") return;

            const me = socket.request.session.userID.toString();
            if (!involves(friendship, me)) return;

            const otherID = friendship.pairLow === me ? friendship.pairHigh : friendship.pairLow;
            const other = whereIs(otherID);
            // Inside a theater is somewhere you are let into, not driven to.
            if (!other.online || other.theaterId || other.position === null) return;

            // Beside them rather than on top of them, and clamped to the road so
            // the arrival is somewhere the world allows.
            const arrival = {
                x: Math.max(WORLD.minX, other.position.x - 60),
                y: Math.min(WORLD.maxY, Math.max(WORLD.minY, other.position.y)),
                at: Date.now(),
            };
            socket.data.worldPosition = arrival;
            worldGrid.place(socket.id, arrival);
            reconcileInterest(io, socket, arrival);

            // The same event a refusal sends: from the client's point of view
            // this is the server saying where it actually is, which is exactly
            // what it is.
            socket.emit("positionCorrection", { x: arrival.x, y: arrival.y });
        });

        socket.on("hubMessage", ({ text } = {}) => {
            if (!isAuthenticated(socket)) return;
            if (typeof text !== "string") return;

            // Standing in the hub is what makes a speech bubble mean anything.
            // Someone who has walked into a theater has left the world — their
            // car is gone from it — so they neither speak into it nor hear it.
            if (instanceRoom(socket) === null) return;

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
            socket.emit("newHubMessage", payload);

            // Asked of the grid rather than by walking every socket on the
            // server and measuring each one. The grid holds exactly the players
            // who are in the world, which is both the faster question and the
            // right one — the sweep it replaces also reached people sitting
            // inside a theater, who still carried the position they parked at.
            for (const listenerId of worldGrid.near(speakerAt, PROXIMITY_RADIUS, socket.id)) {
                io.sockets.sockets.get(listenerId)?.emit("newHubMessage", payload);
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

            // Kept so someone who drives into view later can be told what this
            // car looks like — the carJoined that described it is long gone.
            // Checked here rather than at each place it is sent on: this is
            // the record every later announcement of this car is built from.
            socket.data.car = { color: safeColor(color), name, coords, screen };

            // The spawn position counts. Recording only on movement would leave
            // two people who have just arrived unable to hear each other, which
            // is exactly when they would want to talk.
            applyProposedPosition(socket, coords, screen);

            const joinedAt = socket.data.worldPosition;
            if (joinedAt) {
                worldGrid.place(socket.id, joinedAt);
                reconcileInterest(io, socket, joinedAt);
            }
        });

        // Both of these keep socket.data.car in step. It is the only record of
        // what a car looks like once the carJoined that described it is gone, so
        // leaving it at the joining description meant repainting your car out of
        // sight and then driving over in the old colour.
        socket.on("carUpdate", ({ name, color }) => {
            if (!isAuthenticated(socket)) return;
            if (instanceRoom(socket) === null) return;

            const checked = safeColor(color);
            if (socket.data.car) {
                socket.data.car.name = name;
                socket.data.car.color = checked;
            }
            emitToWatchers(io, socket, "newCarUpdate", { id: socket.id, name, color: checked });
        });

        socket.on("colorChanged", ({ color }) => {
            if (!isAuthenticated(socket)) return;
            if (instanceRoom(socket) === null) return;

            const checked = safeColor(color);
            if (socket.data.car) {
                socket.data.car.color = checked;
            }
            emitToWatchers(io, socket, "newColorChanged", { id: socket.id, color: checked });
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
            forgetPlayer(io, socket);
            socket.leave(room);
            hub.leave(socket.id);
            delete socket.data.instanceId;
        });

        socket.on("disconnect", () => {
            forgetPlayer(io, socket);
            hub.leave(socket.id);
            // Deliberately does not announce the strip as changed. A disconnect
            // is not a change to it; freeing a seat is, and chatSocket says so
            // from the code that frees one. Announcing it here made every closed
            // tab cost a listing request from every connected client.
        });
    });
};

export default socket;

import { ObjectId } from "mongodb";
import { limits } from "../limits.js";
import { offersLiveVideo } from "../world/sdp.js";
import { areFriends } from "../services/friendService.js";

/**
 * Signalling for the voice and camera mesh.
 *
 * The media itself never touches this server — that is the whole design. Peers
 * connect directly and, when they cannot, through TURN, which is the one
 * recurring cost the roadmap accepts. What passes through here is the
 * introduction: who is in the call, and the offers, answers and candidates two
 * clients need to exchange before they can talk.
 *
 * That has two consequences worth stating.
 *
 * The cap is a product constraint, not a setting. A mesh is every participant
 * connected to every other, so bandwidth and encode cost grow with the square of
 * the group: five people is twenty streams, ten is ninety. It is enforced here
 * because a client that ignored it would degrade the call for everyone else in
 * it, not just for itself.
 *
 * The camera gate is enforced on the signalling, because there is nowhere else
 * to enforce it. A peer connection cannot be established without an SDP, and an
 * SDP says whether it carries video in the open — so an offer with a live video
 * section going to someone who is not a friend is refused here, and no amount of
 * client modification gets around a relay that will not carry it.
 */

/** Who is in the call, and where it is: derived, never a second source of truth. */
function callRoom(socket) {
    const theaterId = socket.data.theaterId;
    if (!ObjectId.isValid(theaterId) || !socket.rooms.has(theaterId)) {
        return null;
    }
    return theaterId;
}

function isAuthenticated(socket) {
    return socket.request.session?.loggedIn === true;
}

/**
 * Everyone currently in this theater's call.
 *
 * Read from the sockets in the room rather than kept in a map beside them. A map
 * would need to stay in step with connects, disconnects, reconnects and people
 * walking out of theaters — a second way to be wrong about who is present, in
 * exchange for nothing at this size.
 */
async function participants(io, theaterId) {
    const sockets = await io.in(theaterId).fetchSockets();
    return sockets.filter((peer) => peer.data.inCall === true);
}

function describe(peer) {
    return {
        id: peer.id,
        userID: peer.data.userID ?? null,
        username: peer.data.username ?? null,
    };
}

const socket = (io) => {
    io.on("connection", (socket) => {
        /**
         * Join the call in the theater this socket is already inside.
         *
         * Answering with the peers already there, rather than having the joiner
         * discover them, is what makes the mesh deterministic: the arriving peer
         * offers to each of them, and they answer. Both sides trying to offer is
         * the classic way a mesh ends up with two half-open connections between
         * the same pair.
         */
        socket.on("voiceJoin", async () => {
            if (!isAuthenticated(socket)) return;

            const theaterId = callRoom(socket);
            if (theaterId === null) return;
            if (socket.data.inCall === true) return;

            const already = await participants(io, theaterId);
            if (already.length >= limits.voiceCapacity) {
                socket.emit("voiceFull", {
                    message: `This call is full (${limits.voiceCapacity} people).`,
                    capacity: limits.voiceCapacity,
                });
                return;
            }

            socket.data.inCall = true;
            socket.data.callTheaterId = theaterId;
            socket.data.username = socket.request.session.username ?? null;

            const me = socket.request.session.userID?.toString() ?? null;
            socket.data.userID = me;

            // Whether the camera may be pointed at each of them, decided here
            // rather than asked of the client.
            const peers = [];
            for (const peer of already) {
                peers.push({
                    ...describe(peer),
                    cameraAllowed: await areFriends(me, peer.data.userID),
                });
            }

            socket.emit("voiceJoined", { peers, capacity: limits.voiceCapacity });

            for (const peer of already) {
                peer.emit("voicePeerJoined", {
                    ...describe(socket),
                    cameraAllowed: await areFriends(peer.data.userID, me),
                });
            }
        });

        /**
         * Pass one peer's offer, answer or candidate to another.
         *
         * Addressed rather than broadcast: everything here is between exactly
         * two peers, and sending it to the room would tell three uninvolved
         * clients about a connection they are not part of.
         */
        socket.on("voiceSignal", async ({ to, description, candidate } = {}) => {
            if (!isAuthenticated(socket)) return;
            if (socket.data.inCall !== true) return;

            const theaterId = callRoom(socket);
            if (theaterId === null) return;

            const peer = io.sockets.sockets.get(to);
            // Same theater, same call: a socket id is guessable, and without
            // this it would be an address into any call on the server.
            if (!peer || peer.data.inCall !== true || peer.data.theaterId !== theaterId) return;

            if (description !== undefined) {
                if (offersLiveVideo(description)) {
                    const allowed = await areFriends(
                        socket.request.session.userID?.toString(),
                        peer.data.userID
                    );
                    if (!allowed) {
                        socket.emit("voiceCameraRefused", { to });
                        return;
                    }
                }
                peer.emit("voiceSignal", { from: socket.id, description });
                return;
            }

            if (candidate !== undefined) {
                peer.emit("voiceSignal", { from: socket.id, candidate });
            }
        });

        socket.on("voiceLeave", () => leaveCall(io, socket));

        // `disconnecting` rather than `disconnect`: the socket is still in its
        // rooms here, so the people to tell are still reachable.
        socket.on("disconnecting", () => leaveCall(io, socket));

        // Walking out of a theater leaves its call with it.
        socket.on("leftTheater", () => leaveCall(io, socket));
    });
};

function leaveCall(io, socket) {
    if (socket.data.inCall !== true) return;

    socket.data.inCall = false;

    // The call remembers its own theater rather than reading the socket's
    // current one. chatSocket listens for the same two events and clears
    // `data.theaterId` as it goes, so which of the two ran first would decide
    // whether anyone was told this peer had left.
    const theaterId = socket.data.callTheaterId;
    socket.data.callTheaterId = null;
    if (!ObjectId.isValid(theaterId)) return;

    // Told rather than discovered: a peer whose connection simply goes quiet
    // looks exactly like a bad network, and the client would keep the tile on
    // screen waiting for it to come back.
    socket.to(theaterId).emit("voicePeerLeft", { id: socket.id });
}

export default socket;

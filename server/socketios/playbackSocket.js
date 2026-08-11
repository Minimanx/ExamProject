/**
 * Synchronised playback for a theater.
 *
 * No video passes through here. Each viewer opens their own copy from their own
 * disk; what travels is a description of where the film should be —
 * `{ playing, positionSeconds }` — and every player is steered to match. The
 * server never learns anything about the film beyond a number of seconds.
 *
 * The host owns that state. Hiding the controls from everyone else is a UI
 * decision an honest client respects and a modified one ignores, so the rule
 * holds here instead.
 */

import { ObjectId } from "mongodb";
import { findTheater } from "../services/theaterService.js";

/**
 * Playback state per theater, in memory.
 *
 * It is worth nothing once the showing ends and it changes many times a minute,
 * so persisting it would mean a database write per scrub for data with a
 * lifetime of hours. A restart costs the room one press of play.
 */
const playbackByTheater = new Map();

const COUNTDOWN_SECONDS = 3;

function stateFor(theaterId) {
    if (!playbackByTheater.has(theaterId)) {
        playbackByTheater.set(theaterId, {
            playing: false,
            positionSeconds: 0,
            updatedAt: Date.now(),
            ready: new Set(),
            readyCheckOpen: false,
        });
    }
    return playbackByTheater.get(theaterId);
}

/** What a client is told. The Set is not serialisable and not theirs. */
function published(state) {
    return {
        playing: state.playing,
        positionSeconds: state.positionSeconds,
        updatedAt: state.updatedAt,
        ready: [...state.ready],
        readyCheckOpen: state.readyCheckOpen,
    };
}

/**
 * The theater this socket is inside, or null.
 *
 * Read from the room it actually joined rather than from anything it sends: a
 * socket that has not joined a theater has no business steering one.
 */
function theaterOf(socket) {
    const theaterId = socket.data.theaterId;
    if (!ObjectId.isValid(theaterId) || !socket.rooms.has(theaterId)) {
        return null;
    }
    return theaterId;
}

async function isHost(socket, theaterId) {
    const theater = await findTheater(theaterId);
    const userID = socket.request.session?.userID?.toString();
    return theater !== null && userID !== undefined && theater.ownerID === userID;
}

/** A position has to be a real, non-negative number of seconds. */
function isFiniteSeconds(value) {
    return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

const socket = (io) => {
    io.on("connection", (socket) => {
        /** Every host action is "change the state, then tell the room". */
        async function asHost(change) {
            const theaterId = theaterOf(socket);
            if (theaterId === null) return;
            if (!(await isHost(socket, theaterId))) return;

            const state = stateFor(theaterId);
            if (change(state, theaterId) === false) return;

            state.updatedAt = Date.now();
            io.to(theaterId).emit("playbackState", published(state));
        }

        // Asked for on arrival, so someone joining half an hour in lands where
        // the film is rather than at the beginning.
        socket.on("playbackSync", () => {
            const theaterId = theaterOf(socket);
            if (theaterId === null) return;

            socket.emit("playbackState", published(stateFor(theaterId)));
        });

        socket.on("playbackPlay", ({ positionSeconds } = {}) =>
            asHost((state) => {
                if (isFiniteSeconds(positionSeconds)) {
                    state.positionSeconds = positionSeconds;
                }
                state.playing = true;
            })
        );

        socket.on("playbackPause", ({ positionSeconds } = {}) =>
            asHost((state) => {
                if (isFiniteSeconds(positionSeconds)) {
                    state.positionSeconds = positionSeconds;
                }
                state.playing = false;
            })
        );

        socket.on("playbackSeek", ({ positionSeconds } = {}) =>
            asHost((state) => {
                // Nothing to broadcast if the position is unusable: leaving the
                // room where it is beats moving it somewhere meaningless.
                if (!isFiniteSeconds(positionSeconds)) return false;
                state.positionSeconds = positionSeconds;
            })
        );

        socket.on("readyCheck", () =>
            asHost((state) => {
                // Cleared, because the question is being asked again. Carrying
                // old answers forward would show a room that is ready when
                // nobody has answered the question actually on the table.
                state.ready.clear();
                state.readyCheckOpen = true;
            })
        );

        socket.on("ready", () => {
            const theaterId = theaterOf(socket);
            if (theaterId === null) return;

            const userID = socket.request.session?.userID?.toString();
            if (!userID) return;

            const state = stateFor(theaterId);
            if (!state.readyCheckOpen) return;

            state.ready.add(userID);
            io.to(theaterId).emit("playbackState", published(state));
        });

        // A countdown is a message rather than state: every client renders the
        // same numbers from the same instant, so nobody is waiting on a round
        // trip at the moment the film starts.
        socket.on("startCountdown", () =>
            asHost((state, theaterId) => {
                state.readyCheckOpen = false;
                io.to(theaterId).emit("playbackCountdown", { seconds: COUNTDOWN_SECONDS });
            })
        );
    });
};

/**
 * Forget every theater's playback state.
 *
 * The map outlives any one socket, so without this a test would inherit the
 * position the previous one left behind.
 */
export function resetPlaybackState() {
    playbackByTheater.clear();
}

export { COUNTDOWN_SECONDS };
export default socket;

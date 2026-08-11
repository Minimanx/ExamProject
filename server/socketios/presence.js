/**
 * Who is actually inside a theater right now.
 *
 * `usersInsideTheater` was written by the HTTP join and cleared by the socket's
 * disconnect handler. Anything that broke that pairing — a tab closed before
 * the socket opened, a dropped connection, a server restart — left a ghost
 * holding a seat for the life of the theater, and nothing ever reconciled the
 * stored list against who was really there. See defect C5.
 *
 * The socket rooms are the ground truth: a connection either exists or it does
 * not, and a restart clears them all. The stored list is a record that has to
 * be checked against them.
 */

let socketServer = null;

export function registerSocketServer(io) {
    socketServer = io;
}

/**
 * Whether this user has a socket open anywhere.
 *
 * The same question this module already answers for a theater room, asked of
 * every connection instead. Sockets are the only thing that knows: a session
 * outlives a closed tab, so asking the database would report everyone who logged
 * in this fortnight as present.
 */
/**
 * Where a user is, for a friend who is allowed to join them.
 *
 * This deliberately bypasses interest management, which exists so players cannot
 * see everyone's position. The caller is responsible for having established that
 * the two are actually friends — see friendRouter.
 */
export function whereIs(userID) {
    const socket = socketFor(userID);
    if (socket === null) {
        return { online: false, position: null, theaterId: null };
    }

    const at = socket.data.worldPosition;
    return {
        online: true,
        position: at ? { x: at.x, y: at.y } : null,
        theaterId: socket.data.theaterId ?? null,
    };
}

function socketFor(userID) {
    if (socketServer === null) {
        return null;
    }

    for (const socket of socketServer.sockets.sockets.values()) {
        if (socket.request.session?.userID?.toString() === userID) {
            return socket;
        }
    }
    return null;
}

export function isOnline(userID) {
    return socketFor(userID) !== null;
}

/**
 * The user ids with a live socket in this theater's room, or null when there is
 * no socket server to ask — in which case the caller must not sweep anyone,
 * since "no sockets" and "cannot tell" would otherwise look identical.
 */
export async function liveOccupants(theaterId) {
    if (socketServer === null) {
        return null;
    }

    const sockets = await socketServer.in(theaterId).fetchSockets();
    return new Set(sockets.map((socket) => socket.data.userID).filter(Boolean));
}

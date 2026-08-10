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

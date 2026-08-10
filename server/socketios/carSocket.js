const POSITION_THROTTLE_MS = 50;

/** Car events are only meaningful from a logged-in player. See defect S4. */
function isAuthenticated(socket) {
    return socket.request.session?.loggedIn === true;
}

const socket = (io) => {
    io.on("connection", (socket) => {
        let lastPositionBroadcast = 0;

        // `socket.id` is always the server's own view of the connection. The
        // client used to supply an `id` which was echoed to everyone, letting a
        // player move or impersonate another player's car. See defect S3.
        socket.on("carPosition", ({ coords, direction, screen }) => {
            if (!isAuthenticated(socket)) return;

            const now = Date.now();
            if (now - lastPositionBroadcast < POSITION_THROTTLE_MS) return;
            lastPositionBroadcast = now;

            socket.broadcast.emit("newCarPosition", { id: socket.id, coords, direction, screen });
        });

        socket.on("carJoined", ({ coords, color, name, screen }) => {
            if (!isAuthenticated(socket)) return;
            socket.broadcast.emit("newCarJoined", { id: socket.id, color, coords, name, screen });
        });

        socket.on("carUpdate", ({ name, color }) => {
            if (!isAuthenticated(socket)) return;
            socket.broadcast.emit("newCarUpdate", { id: socket.id, name, color });
        });

        socket.on("colorChanged", ({ color }) => {
            if (!isAuthenticated(socket)) return;
            socket.broadcast.emit("newColorChanged", { id: socket.id, color });
        });

        socket.on("theaterAdded", () => {
            if (!isAuthenticated(socket)) return;
            io.emit("newTheaterAdded");
        });

        socket.on("joinedTheater", () => {
            if (!isAuthenticated(socket)) return;
            socket.broadcast.emit("newJoinedTheater", { id: socket.id });
            socket.broadcast.emit("carLeft", { id: socket.id });
        });

        socket.on("disconnect", () => {
            io.emit("newTheaterAdded");
            socket.broadcast.emit("carLeft", { id: socket.id });
        });
    });
};

export default socket;

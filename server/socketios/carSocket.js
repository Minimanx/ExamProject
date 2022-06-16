const socket = (io) => {
    io.on("connection", (socket) => {
        socket.on("carPosition", ({ id, coords, direction, screen }) => {
            socket.broadcast.emit("newCarPosition", { id, coords, direction, screen });
        });
        socket.on("carJoined", ({ id, coords, color, name, screen }) => {
            socket.broadcast.emit("newCarJoined", { id, color, coords, name, screen });
        });
        socket.on("carUpdate", ({ name, color }) => {
            socket.broadcast.emit("newCarUpdate", { id: socket.id, name, color });
        });
        socket.on("colorChanged", ({ id, color }) => {
            socket.broadcast.emit("newColorChanged", { id, color });
        });
        socket.on("theaterAdded", () => {
            io.emit("newTheaterAdded");
        });
        socket.on("joinedTheater", () => {
            socket.broadcast.emit("newJoinedTheater", { id: socket.id });
            socket.broadcast.emit("carLeft", { id: socket.id });
        });
        socket.on("disconnect", () => {
            io.emit("newTheaterAdded");
            socket.broadcast.emit("carLeft", { id: socket.id });
        });
    });
}

export default socket;
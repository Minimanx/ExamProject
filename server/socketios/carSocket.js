const socket = (io) => {
    io.on("connection", (socket) => {
        socket.on("disconnect", () => {
            socket.broadcast.emit("newCarLeft", { id: socket.id });
        });
        socket.on("carPosition", ({ id, coords, direction, screen }) => {
            //const username = socket.request.session.username;
            socket.broadcast.emit("newCarPosition", { id, coords, direction, screen });
        });
        socket.on("carJoined", ({ id, coords, color, name, screen }) => {
            socket.broadcast.emit("newCarJoined", { id: id, color: color, coords: coords, name: name, screen: screen });
        });
        socket.on("colorChanged", ({ id, color }) => {
            socket.broadcast.emit("newColorChanged", { id: id, color: color });
        });
        socket.on("theaterAdded", () => {
            io.emit("newTheaterAdded");
        });
    });
}

export default socket;
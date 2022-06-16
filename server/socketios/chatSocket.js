import db from "../database/createConnection.js";
import { ObjectId } from "mongodb";

const socket = (io) => {
    io.on("connection", (socket) => {
        socket.on("enteredTheater", () => {
            socket.join(socket.request.session.theater);
            io.to(socket.request.session.theater).emit("newMessage", { text: socket.request.session.username + " joined the theater", username: "System", color: "#646464" });
        });
        socket.on("sendNewMessage", ({ sendMessage, color }) => {
            io.to(socket.request.session.theater).emit("newMessage", { text: sendMessage, username: socket.request.session.username, color });
        });
        socket.on("disconnecting", async () => {
            if(socket.rooms.size === 2) {
                await db.theaters.updateOne({ _id: ObjectId(socket.request.session.theater) }, { $pull: { usersInsideTheater: socket.request.session.userID }});
                io.to(socket.request.session.theater).emit("newMessage", { text: socket.request.session.username + " left the theater", username: "System", color: "#646464" });
                socket.request.session.theater = undefined;
            }
        });
    });
}
export default socket;
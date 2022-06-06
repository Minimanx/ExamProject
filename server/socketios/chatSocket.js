import db from "../database/createConnection.js";
import { ObjectId } from "mongodb";

const socket = (io) => {
    io.on("connection", (socket) => {
        socket.on("enteredTheater", () => {
            const theater = socket.request.session.theater;
            socket.join(theater);
        });
        socket.on("sendNewMessage", ({ message }) => {
            io.to(socket.request.session.theater).emit("newMessage", { message, user: socket.request.session.username });
        });
        socket.on("disconnecting", async () => {
            if(socket.rooms.size === 2) {
                await db.theaters.updateOne({ _id: ObjectId(socket.request.session.theater) }, { $pull: { usersInsideTheater: socket.request.session.userID }});
                socket.request.session.theater = undefined;
            }
        });
    });
}
export default socket;
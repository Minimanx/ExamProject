import { ObjectId } from "mongodb";
import { safeColor } from "../world/colors.js";
import { removeOccupant } from "../services/theaterService.js";
import { logger } from "../logger.js";

const MAX_MESSAGE_LENGTH = 200;
const MESSAGE_WINDOW_MS = 10000;
const MAX_MESSAGES_PER_WINDOW = 10;

const socket = (io) => {
    io.on("connection", (socket) => {
        socket.on("enteredTheater", ({ theaterId } = {}) => {
            socket.request.session.reload((err) => {
                if (err) {
                    logger.error({ err, socketId: socket.id }, "Failed to refresh socket session");
                    return;
                }

                const sessionTheaterId = socket.request.session.theater?.toString();
                if (!ObjectId.isValid(sessionTheaterId) || sessionTheaterId !== theaterId) return;

                socket.data.theaterId = sessionTheaterId;
                // Recorded on the socket so presence.liveOccupants can map a
                // room's connections back to users. See defect C5.
                socket.data.userID = socket.request.session.userID?.toString();
                socket.join(sessionTheaterId);
                io.to(sessionTheaterId).emit("newMessage", {
                    text: socket.request.session.username + " joined the theater",
                    username: "System",
                    color: "#646464",
                });
            });
        });
        socket.on("sendNewMessage", ({ sendMessage, color }) => {
            const theaterId = socket.data.theaterId;
            if (!ObjectId.isValid(theaterId) || !socket.rooms.has(theaterId)) return;

            // Until now the only limit was the client's maxlength attribute, so
            // a crafted client could flood a theater with arbitrary payloads.
            // See defect S7.
            if (typeof sendMessage !== "string") return;

            const text = sendMessage.trim();
            if (!text || text.length > MAX_MESSAGE_LENGTH) return;

            const now = Date.now();
            socket.data.messageTimes = (socket.data.messageTimes ?? []).filter(
                (at) => now - at < MESSAGE_WINDOW_MS
            );
            if (socket.data.messageTimes.length >= MAX_MESSAGES_PER_WINDOW) return;
            socket.data.messageTimes.push(now);

            io.to(theaterId).emit("newMessage", {
                text,
                username: socket.request.session.username,
                // Checked, not relayed: this is rendered into a style attribute
                // on every screen in the theater. See world/colors.
                color: safeColor(color),
            });
        });
        socket.on("leftTheater", () => handleLeaveTheater(socket, io));
        socket.on("disconnecting", () => handleLeaveTheater(socket, io));
    });
};

function handleLeaveTheater(socket, io) {
    leaveTheater(socket, io).catch((err) => {
        logger.error({ err, socketId: socket.id }, "Failed to leave theater");
    });
}

async function leaveTheater(socket, io) {
    const theaterId = socket.data.theaterId || socket.request.session.theater;
    const sessionUserId = socket.request.session.userID?.toString();
    if (!ObjectId.isValid(theaterId) || !sessionUserId || !socket.rooms.has(theaterId)) return;

    socket.leave(theaterId);
    delete socket.data.theaterId;
    await removeOccupant(theaterId, sessionUserId);
    io.to(theaterId).emit("newMessage", {
        text: socket.request.session.username + " left the theater",
        username: "System",
        color: "#646464",
    });

    // The strip shows how many seats each theater has left, and one has just
    // come back. Said from here, where the seat is actually freed, rather than
    // from every disconnect — which announced a change on connections that had
    // never been in a theater, and stayed silent when someone walked out of one.
    io.emit("newTheaterAdded");
    socket.request.session.theater = undefined;
    socket.request.session.save();
}

export default socket;

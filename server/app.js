import express from "express";
import path from "path"
import http from "http";
import { Server } from "socket.io";
import sanitize from "mongo-sanitize";
import rateLimit from "express-rate-limit";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

import session from "express-session";
const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
});
app.use(sessionMiddleware);

const baseLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
	max: 1000,
	standardHeaders: true,
	legacyHeaders: false,
});
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
	max: 10,
	standardHeaders: true,
	legacyHeaders: false,
});
app.use(baseLimiter);

function sanitizeRequest(req, res, next) {
    sanitize(req.body);
    sanitize(req.query);
    sanitize(req.params);
    next();
}
app.use(sanitizeRequest)

app.use(express.json())

const wrap = middleware => (socket, next) => middleware(socket.request, {}, next);
io.use(wrap(sessionMiddleware));

import carSocket from "./socketios/carSocket.js";
carSocket(io);
import chatSocket from "./socketios/chatSocket.js";
chatSocket(io);

app.use(express.static(path.resolve("../client/public")));

import theaterRouter from "./routers/theaterRouter.js";
app.use(theaterRouter);
import movieRouter from "./routers/movieRouter.js";
app.use(movieRouter);
import userRouter from "./routers/userRouter.js";
app.use(userRouter);
app.use(loginLimiter);
import loginRouter from "./routers/loginRouter.js";
app.use(loginRouter);

app.get("*", (req, res) => {
    res.sendFile(path.resolve("../client/public/index.html"));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log("Server running on port: ", PORT);
});
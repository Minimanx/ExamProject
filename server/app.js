import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import { Server } from "socket.io";
import sanitize from "mongo-sanitize";
import rateLimit from "express-rate-limit";
import cors from "cors";
import MongoStore from "connect-mongo";
import { mongoClientPromise } from "./database/createConnection.js";

const app = express();
const server = http.createServer(app);
const isProduction = process.env.NODE_ENV === "production";
const configuredOrigins = process.env.CLIENT_ORIGINS;
const allowedOrigins = (configuredOrigins || "http://localhost:5000,http://localhost:8080")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);

if (isProduction && !configuredOrigins) {
    throw new Error("CLIENT_ORIGINS is required in production");
}

if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET is required");
}

function isOriginAllowed(origin) {
    return !origin || allowedOrigins.includes(origin);
}

const corsOptions = {
    origin: (origin, callback) => callback(null, isOriginAllowed(origin)),
    credentials: true,
};

const io = new Server(server, {
    cors: corsOptions,
    allowRequest: (req, callback) => callback(null, isOriginAllowed(req.headers.origin)),
});

app.set("trust proxy", 1);
app.use(cors(corsOptions));

import session from "express-session";
const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET,
    store: MongoStore.create({
        clientPromise: mongoClientPromise,
        dbName: "FlixDrive",
        collectionName: "sessions",
    }),
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
    }
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

app.get("/health", (req, res) => {
    res.status(200).send({ status: "ok" });
});

const wrap = middleware => (socket, next) => middleware(socket.request, {}, next);
io.use(wrap(sessionMiddleware));

import carSocket from "./socketios/carSocket.js";
carSocket(io);
import chatSocket from "./socketios/chatSocket.js";
chatSocket(io);

import theaterRouter from "./routers/theaterRouter.js";
app.use(theaterRouter);
import movieRouter from "./routers/movieRouter.js";
app.use(movieRouter);
import userRouter from "./routers/userRouter.js";
app.use(userRouter);
app.use(loginLimiter);
import loginRouter from "./routers/loginRouter.js";
app.use(loginRouter);

if (process.env.SERVE_CLIENT === "true") {
    const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
    const clientPublicDirectory = path.resolve(currentDirectory, "../client/public");
    app.use(express.static(clientPublicDirectory));
    app.get("*", (req, res) => {
        res.sendFile(path.join(clientPublicDirectory, "index.html"));
    });
} else {
    app.use((req, res) => {
        res.status(404).send({ message: "Not found" });
    });
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log("Server running on port: ", PORT);
});

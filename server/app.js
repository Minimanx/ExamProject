import express from "express";
import http from "http";
import { Server } from "socket.io";
import sanitize from "mongo-sanitize";
import rateLimit from "express-rate-limit";
import cors from "cors";
import helmet from "helmet";
import MongoStore from "connect-mongo";
import { mongoClientPromise } from "./database/createConnection.js";
import { validateConfig } from "./config.js";
import { checkMongoHealth } from "./health.js";
import { logger, httpLogger } from "./logger.js";
import { sendError } from "./errors.js";

const app = express();
const server = http.createServer(app);
const isProduction = process.env.NODE_ENV === "production";
const configuredOrigins = process.env.CLIENT_ORIGINS;
const allowedOrigins = (configuredOrigins || "http://localhost:5000,http://localhost:8080")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);

// One place, one report: every configuration problem is named at boot rather
// than surfacing at whichever request first needs the missing setting.
const { warnings } = validateConfig();
for (const warning of warnings) {
    logger.warn({ warning }, "Configuration warning");
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
// First in the chain so every later line, including rejections from middleware,
// carries a request id. See defect O3.
app.use(httpLogger);
// contentSecurityPolicy is off: the API serves JSON only. The CSP that matters
// belongs with the client, which Vercel deploys and serves separately.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors(corsOptions));

// The session cookie is sameSite:"none" in production, because the client is on
// a different origin — so the browser attaches it to cross-site requests too.
// SameSite therefore cannot be the defence. Reject state-changing requests that
// declare an origin we do not know. A missing Origin is allowed: same-origin
// form posts and non-browser clients omit it, and only a present-and-wrong
// origin is evidence of a cross-site attempt. See defect S5.
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

app.use((req, res, next) => {
    if (SAFE_METHODS.has(req.method)) return next();

    const origin = req.get("Origin");
    if (origin && !isOriginAllowed(origin.replace(/\/$/, ""))) {
        res.status(403).send({ message: "Cross-origin request rejected" });
        return;
    }

    next();
});

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
    },
});
app.use(sessionMiddleware);

const baseLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 1000,
    standardHeaders: true,
    legacyHeaders: false,
});
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(baseLimiter);

app.use(express.json());

// Strips $-prefixed keys so a Mongo operator cannot be smuggled into a query.
// Ordering is load-bearing: this MUST run after express.json(). Registered
// before it, req.body is still undefined and the call silently does nothing —
// that was defect S9, an unauthenticated account takeover via
// `token: {"$ne": null}` on /resetpassword.
//
// Only the body needs sanitizing. req.params values are always strings, and
// req.query cannot hold nested objects under the "simple" parser asserted
// below — it is also a getter returning a fresh object per access, so
// mutating it in place would be a no-op anyway.
app.set("query parser", "simple");

// mongo-sanitize recurses without a depth limit, so a deeply nested body well
// inside body-parser's 100 kB cap can overflow the stack. Reject those before
// sanitizing. The walk is iterative for the same reason.
const MAX_BODY_DEPTH = 32;

function isTooDeep(root, limit) {
    const stack = [[root, 0]];
    while (stack.length > 0) {
        const [value, depth] = stack.pop();
        if (value === null || typeof value !== "object") continue;
        if (depth >= limit) return true;
        for (const child of Object.values(value)) {
            stack.push([child, depth + 1]);
        }
    }
    return false;
}

function sanitizeRequest(req, res, next) {
    if (isTooDeep(req.body, MAX_BODY_DEPTH)) {
        sendError(res, "VALIDATION_FAILED", "Request body is nested too deeply");
        return;
    }
    sanitize(req.body);
    next();
}
app.use(sanitizeRequest);

app.get("/health", async (req, res) => {
    const mongoHealthy = await checkMongoHealth(await mongoClientPromise);

    // 503 rather than 200-with-a-flag: the point of this endpoint is to let a
    // load balancer stop sending traffic here, and it decides on the status
    // code. DEPLOYMENT.md already promises a bad database URI keeps the
    // deployment unhealthy; this extends that promise past boot.
    res.status(mongoHealthy ? 200 : 503).send({
        status: mongoHealthy ? "ok" : "degraded",
        mongo: mongoHealthy ? "ok" : "unreachable",
    });
});

const wrap = (middleware) => (socket, next) => middleware(socket.request, {}, next);
io.use(wrap(sessionMiddleware));

import { registerSocketServer } from "./socketios/presence.js";
registerSocketServer(io);

import carSocket from "./socketios/carSocket.js";
carSocket(io);
import playbackSocket from "./socketios/playbackSocket.js";
playbackSocket(io);

import chatSocket from "./socketios/chatSocket.js";
chatSocket(io);

import theaterRouter from "./routers/theaterRouter.js";
app.use(theaterRouter);
import movieRouter from "./routers/movieRouter.js";
app.use(movieRouter);
import userRouter from "./routers/userRouter.js";
app.use(userRouter);
// Scoped to the credential endpoints by path. Registered path-less, this
// limiter also counted everything that fell through routing — every 404, and
// every static asset under SERVE_CLIENT=true — so ten stray requests from one
// NAT'd IP locked everyone behind it out of logging in. See defect O6.
app.use(["/login", "/forgotpassword", "/resetpassword"], loginLimiter);
import loginRouter from "./routers/loginRouter.js";
app.use(loginRouter);

if (process.env.NODE_ENV === "test") {
    app.get("/__test_async_boom", async () => {
        throw new Error("boom");
    });
}

app.use((req, res) => {
    sendError(res, "NOT_FOUND", "Not found");
});

app.use((err, req, res, next) => {
    req.log.error({ err }, "Unhandled request error");

    if (res.headersSent) {
        return next(err);
    }

    // body-parser sets err.status on a malformed or oversized body, so its own
    // 400/413 must survive rather than being flattened to 500.
    const status = err.status || err.statusCode || 500;
    res.status(status).send({
        message: status >= 500 ? "Something went wrong" : err.message,
        code: status >= 500 ? "INTERNAL" : "VALIDATION_FAILED",
    });
});

export { app, server, io };

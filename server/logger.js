/**
 * Structured logging with a request id on every line.
 *
 * Everything used to go through console.log and console.error: prose, no
 * level, no timestamp, and no way to tie a line to the request that produced
 * it. Under any concurrency that leaves you reading interleaved output from
 * several requests and guessing which lines belong together. See defect O3.
 *
 * pino emits one JSON object per line, which log aggregators can filter and
 * group on. `requestId` is the field to group on.
 */

import pino from "pino";
import pinoHttp from "pino-http";
import { randomUUID } from "crypto";

export const requestIdHeader = "x-request-id";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
    // Tests assert on captured output, so the level must stay low enough to
    // produce it; silencing here would make those assertions vacuous.
    level: process.env.LOG_LEVEL ?? (isProduction ? "info" : "debug"),
    // Locally the JSON is for reading, so drop the pid/hostname noise. In
    // production it identifies which instance a line came from.
    base: isProduction ? undefined : {},
});

export const httpLogger = pinoHttp({
    logger,
    // A proxy or client that already carries a trace id keeps it, so one id
    // spans the whole hop instead of restarting at this server.
    genReqId: (req, res) => {
        const inbound = req.headers[requestIdHeader];
        const id = typeof inbound === "string" && inbound.length > 0 ? inbound : randomUUID();
        res.setHeader(requestIdHeader, id);
        return id;
    },
    customProps: (req) => ({ requestId: req.id }),
    customSuccessMessage: () => "request completed",
    customErrorMessage: () => "request failed",
    // Health checks fire every few seconds and would otherwise be most of the
    // log. Their failures still surface: /health answers 503, which is a warn.
    customLogLevel: (req, res, err) => {
        if (err || res.statusCode >= 500) return "error";
        if (res.statusCode >= 400) return "warn";
        if (req.url === "/health") return "debug";
        return "info";
    },
    // Deliberately narrow. The default serializers record headers, and these
    // requests carry session cookies, passwords and reset tokens — logging them
    // would turn the log into a second copy of the credential store.
    serializers: {
        req: (req) => ({ method: req.method, url: req.url }),
        res: (res) => ({ status: res.statusCode }),
    },
    customAttributeKeys: { responseTime: "durationMs" },
});

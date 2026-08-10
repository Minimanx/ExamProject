import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import pino from "pino";
import { logger, requestIdHeader } from "../logger.js";

// DEFECT O3 (roadmap spec §5): the server logged with console.log and
// console.error only. Lines arrived as prose with no level, no timestamp and no
// way to tie one to the request that caused it, so diagnosing anything in
// production meant reading interleaved output from every concurrent request and
// guessing which lines belonged together.
describe("structured logging", () => {
    let written;

    beforeEach(() => {
        written = [];
        // pino writes to its destination stream, so capturing there sees the
        // real serialized output rather than what was passed to the call.
        vi.spyOn(logger[pino.symbols.streamSym], "write").mockImplementation((line) => {
            written.push(JSON.parse(line));
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    function linesFor(response) {
        const id = response.headers[requestIdHeader];
        return written.filter((line) => line.requestId === id);
    }

    it("logs one line per completed request, carrying method, path and status", async () => {
        const response = await request(app).get("/health");

        const completed = linesFor(response).filter((line) => line.msg === "request completed");
        expect(completed).toHaveLength(1);
        expect(completed[0]).toMatchObject({
            req: { method: "GET", url: "/health" },
            res: { status: 200 },
        });
        expect(completed[0].durationMs).toBeTypeOf("number");
    });

    it("emits valid JSON with a level and a timestamp", async () => {
        await request(app).get("/health");

        expect(written.length).toBeGreaterThan(0);
        expect(written[0].level).toBeTypeOf("number");
        expect(written[0].time).toBeTypeOf("number");
    });

    // The correlation id is the whole point: without it a line cannot be tied
    // to the request that produced it, which is the state O3 describes.
    it("returns the request id to the caller so a report can name it", async () => {
        const response = await request(app).get("/health");

        expect(response.headers[requestIdHeader]).toBeTruthy();
    });

    it("gives two requests different ids", async () => {
        const first = await request(app).get("/health");
        const second = await request(app).get("/health");

        expect(first.headers[requestIdHeader]).not.toBe(second.headers[requestIdHeader]);
    });

    // A proxy or a client that already has a trace id should keep it, so one id
    // spans the whole hop rather than restarting at this server.
    it("adopts an inbound request id rather than minting a new one", async () => {
        const response = await request(app).get("/health").set(requestIdHeader, "abc-123");

        expect(response.headers[requestIdHeader]).toBe("abc-123");
    });

    it("ties a handler's own log line to the request that caused it", async () => {
        const response = await request(app).get("/__test_async_boom");

        expect(response.status).toBe(500);
        const errors = linesFor(response).filter((line) => line.level >= 50);
        expect(errors.length).toBeGreaterThan(0);
    });

    // Sessions, passwords and reset tokens all travel in these requests. A
    // logger that records bodies or cookies turns the log into a second copy of
    // the credential store.
    it("records no request body and no cookie header", async () => {
        await request(app)
            .post("/login")
            .set("Cookie", "connect.sid=secret-session-value")
            .send({ email: "someone@example.com", password: "hunter22" });

        const serialized = JSON.stringify(written);
        expect(serialized).not.toContain("hunter22");
        expect(serialized).not.toContain("secret-session-value");
    });
});

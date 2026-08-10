import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { app } from "../app.js";

const fetchMock = vi.fn();

describe("GET /movies", () => {
    beforeEach(() => {
        fetchMock.mockReset();
        vi.stubGlobal("fetch", fetchMock);
        process.env.OMDB_API_KEY = "test-omdb-key";
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        process.env.OMDB_API_KEY = "test-omdb-key";
    });

    it("rejects a missing search term", async () => {
        const response = await request(app).get("/movies");

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("A movie title is required");
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("rejects a whitespace-only search term", async () => {
        const response = await request(app).get("/movies?s=%20%20");

        expect(response.status).toBe(400);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("returns 503 when the API key is not configured", async () => {
        delete process.env.OMDB_API_KEY;

        const response = await request(app).get("/movies?s=matrix");

        expect(response.status).toBe(503);
        expect(response.body.message).toBe("Movie search is not configured");
    });

    it("returns provider results on success", async () => {
        const payload = {
            Response: "True",
            Search: [{ Title: "The Matrix", Year: "1999", imdbID: "tt0133093" }],
        };
        fetchMock.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => payload,
        });

        const response = await request(app).get("/movies?s=matrix");

        expect(response.status).toBe(200);
        expect(response.body.data).toEqual(payload);

        const calledUrl = fetchMock.mock.calls[0][0];
        expect(calledUrl.toString()).toContain("s=matrix");
        expect(calledUrl.toString()).toContain("apikey=test-omdb-key");
    });

    it("passes through a provider 'no results' response as 200", async () => {
        fetchMock.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ Response: "False", Error: "Movie not found!" }),
        });

        const response = await request(app).get("/movies?s=zzzzzz");

        expect(response.status).toBe(200);
        expect(response.body.data.Response).toBe("False");
    });

    it("returns 502 when the provider errors", async () => {
        fetchMock.mockResolvedValue({
            ok: false,
            status: 500,
            json: async () => ({ Error: "Server busy" }),
        });

        const response = await request(app).get("/movies?s=matrix");

        expect(response.status).toBe(502);
        expect(response.body.message).toContain("Movie provider error");
    });

    it("returns 502 when the provider is unreachable", async () => {
        fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

        const response = await request(app).get("/movies?s=matrix");

        expect(response.status).toBe(502);
        expect(response.body.message).toBe("Movie search is temporarily unavailable");
    });
});

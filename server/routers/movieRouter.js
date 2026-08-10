import { Router } from "express";
import "dotenv/config";
import { sendError } from "../errors.js";
const router = Router();

router.get("/movies", async (req, res) => {
    const searchTerm = typeof req.query.s === "string" ? req.query.s.trim() : "";

    if (!searchTerm) {
        return sendError(res, "VALIDATION_FAILED", "A movie title is required");
    }
    if (!process.env.OMDB_API_KEY) {
        req.log.error("Movie API request failed: OMDB_API_KEY is not configured");
        return sendError(res, "UNAVAILABLE", "Movie search is not configured");
    }

    const movieApiUrl = new URL("https://www.omdbapi.com/");
    movieApiUrl.searchParams.set("apikey", process.env.OMDB_API_KEY);
    movieApiUrl.searchParams.set("s", searchTerm);
    movieApiUrl.searchParams.set("r", "json");
    movieApiUrl.searchParams.set("page", "1");

    try {
        const response = await fetch(movieApiUrl, {
            signal: AbortSignal.timeout(10000),
        });
        const result = await response.json();

        if (!response.ok || (!Array.isArray(result.Search) && result.Response !== "False")) {
            const providerMessage = result.message || result.Error || `HTTP ${response.status}`;
            req.log.error(
                { status: response.status, reason: providerMessage },
                "Movie API request failed"
            );
            return sendError(
                res,
                "UPSTREAM_UNAVAILABLE",
                `Movie provider error: ${providerMessage}`
            );
        }

        return res.status(200).send({ data: result });
    } catch (error) {
        req.log.error(
            { name: error.name, code: error.code || error.cause?.code },
            "Movie API request failed"
        );
        return sendError(res, "UPSTREAM_UNAVAILABLE", "Movie search is temporarily unavailable");
    }
});

export default router;

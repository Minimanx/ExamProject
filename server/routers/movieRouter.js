import { Router } from "express";
import fetch from "node-fetch";
import "dotenv/config";
const router = Router();

router.get("/movies", async (req, res) => {
    const searchTerm = typeof req.query.s === "string" ? req.query.s.trim() : "";

    if(!searchTerm) {
        return res.status(400).send({ message: "A movie title is required" });
    }
    if(!process.env.OMDB_API_KEY) {
        console.error("Movie API request failed: OMDB_API_KEY is not configured");
        return res.status(503).send({ message: "Movie search is not configured" });
    }

    const movieApiUrl = new URL("https://www.omdbapi.com/");
    movieApiUrl.searchParams.set("apikey", process.env.OMDB_API_KEY);
    movieApiUrl.searchParams.set("s", searchTerm);
    movieApiUrl.searchParams.set("r", "json");
    movieApiUrl.searchParams.set("page", "1");

    try {
        const response = await fetch(movieApiUrl, {
            signal: AbortSignal.timeout(10000)
        });
        const result = await response.json();

        if(!response.ok || (!Array.isArray(result.Search) && result.Response !== "False")) {
            const providerMessage = result.message || result.Error || `HTTP ${response.status}`;
            console.error("Movie API request failed", {
                status: response.status,
                message: providerMessage
            });
            return res.status(502).send({
                message: `Movie provider error: ${providerMessage}`
            });
        }

        return res.status(200).send({ data: result });
    } catch (error) {
        console.error("Movie API request failed", {
            name: error.name,
            code: error.code || error.cause?.code
        });
        return res.status(502).send({ message: "Movie search is temporarily unavailable" });
    }
});

export default router;

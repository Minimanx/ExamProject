import { Router } from "express";
import { ObjectId } from "mongodb";
import "dotenv/config";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { sendError } from "../errors.js";
import { requireSession } from "./requireSession.js";
import { limits } from "../limits.js";
import { validateBody, validateQuery } from "../validate.js";
import { createTheaterSchema, joinTheaterSchema, theaterListingSchema } from "../schemas.js";
import * as theaters from "../services/theaterService.js";
const router = Router();

// Every route that needs a session used to open with the same three lines, and
// the message differed by route, which is why one said "Must be logged in" and
// another "Must be logged in to create a new event".
// The id is a path parameter, so it never reaches the body schema. A malformed
// one is a bad request; a well-formed one that matches nothing is a 404 — it
// used to be a 404 on GET and a 400 on PATCH and DELETE.
function loadTheater(failureMessage) {
    return async (req, res, next) => {
        if (!ObjectId.isValid(req.params.id)) {
            sendError(res, "VALIDATION_FAILED", "Invalid theater");
            return;
        }

        try {
            req.theater = await theaters.findTheater(req.params.id);
        } catch (error) {
            req.log.error({ err: error }, "Failed to load theater");
            sendError(res, "INTERNAL", failureMessage);
            return;
        }

        if (req.theater === null) {
            sendError(res, "NOT_FOUND", "No theater found");
            return;
        }
        next();
    };
}

router.get("/theaters", validateQuery(theaterListingSchema), async (req, res) => {
    res.status(200).send({ data: await theaters.listTheaters(req.log, req.validatedQuery) });
});

router.get("/theaters/:id", requireSession("Must be logged in"), async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
        return sendError(res, "VALIDATION_FAILED", "Invalid theater");
    }

    try {
        const theater = await theaters.findTheaterForViewer(req.params.id);
        if (theater === null) {
            return sendError(res, "NOT_FOUND", "Theater not found");
        }
        return res.status(200).send({ data: theater });
    } catch (error) {
        req.log.error({ err: error }, "Failed to load theater");
        return sendError(res, "INTERNAL", "Failed to load theater");
    }
});

/** The movie details a theater is built around, fetched from OMDB. */
async function fetchMovie(imdbID, log) {
    const movieApiUrl = new URL("https://www.omdbapi.com/");
    movieApiUrl.searchParams.set("apikey", process.env.OMDB_API_KEY);
    movieApiUrl.searchParams.set("r", "json");
    movieApiUrl.searchParams.set("i", imdbID);

    let response;
    let result;
    try {
        response = await fetch(movieApiUrl, { signal: AbortSignal.timeout(10000) });
        result = await response.json();
    } catch (error) {
        log.error(
            { name: error.name, code: error.code || error.cause?.code },
            "Movie API request failed"
        );
        return { failure: "UPSTREAM" };
    }

    if (!response.ok) {
        log.error(
            { status: response.status, reason: result.Error || `HTTP ${response.status}` },
            "Movie API request failed"
        );
        return { failure: "UPSTREAM" };
    }
    if (result.Response === "False") {
        return { failure: "REJECTED", message: result.Error };
    }
    return { movie: result };
}

router.post(
    "/theaters",
    requireSession("Must be logged in to create a new event"),
    validateBody(createTheaterSchema),
    async (req, res) => {
        const requested = req.body.data;

        // The form sends a time of day, so a time already past today means
        // tomorrow. The window then bounds how far ahead an event may be.
        const windowMs = limits.schedulingWindowHours * 3600000;
        let startTime = new Date(requested.startTime);
        if (startTime.getTime() < Date.now()) {
            startTime = new Date(startTime.getTime() + 86400000);
        }
        if (startTime.getTime() > Date.now() + windowMs || startTime.getTime() < Date.now()) {
            sendError(
                res,
                "VALIDATION_FAILED",
                `Time must be within ${limits.schedulingWindowHours} hours`
            );
            return;
        }

        await theaters.removeExpiredTheaters(req.log);

        // A fast path for the ordinary case, so someone who already has an event
        // gets the plain explanation without a call to OMDB first. The unique
        // index is what actually enforces it — see the catch below.
        const ownerID = req.session.userID.toString();
        if ((await theaters.ownerEventCount(ownerID)) >= limits.maxEventsPerOwner) {
            sendError(res, "CONFLICT", "You already have an ongoing event");
            return;
        }

        if (!process.env.OMDB_API_KEY) {
            req.log.error("Movie API request failed: OMDB_API_KEY is not configured");
            return sendError(res, "UNAVAILABLE", "Movie search is not configured");
        }

        const { movie, failure, message } = await fetchMovie(requested.imdbID, req.log);
        if (failure === "UPSTREAM") {
            return sendError(
                res,
                "UPSTREAM_UNAVAILABLE",
                "Movie details are temporarily unavailable"
            );
        }
        if (failure === "REJECTED") {
            return sendError(res, "VALIDATION_FAILED", message);
        }

        const movieRuntime = Number(movie.Runtime.split(" ")[0]);
        // Generated here rather than asked of the host: the old password was
        // something they had to invent and then pass on out of band, stored
        // bcrypt-hashed so nobody could read it back to share it.
        const lobbyKey = requested.private ? theaters.generateLobbyKey() : undefined;

        // Built field by field rather than from req.body.data. The old code
        // stored the request body itself and overwrote the fields it cared
        // about, so anything the client invented — a slot, an imdbRating, an
        // _id — was persisted verbatim wherever the handler happened not to
        // write over it. See defect C3.
        let created;
        try {
            created = await theaters.createTheater(
                {
                    eventName: requested.eventName,
                    startTime,
                    amountOfSpaces: requested.amountOfSpaces,
                    imdbID: requested.imdbID,
                    isPrivate: requested.private,
                    // Spread so a public theater has no key field at all, rather
                    // than a null one that later reads as "a key exists".
                    ...(requested.private && { lobbyKey }),
                    ownerID,
                    movieName: movie.Title,
                    // Spread rather than set to undefined: the driver stores
                    // undefined as null, and the field was previously absent for
                    // short titles.
                    ...(movie.Title.length > 18 && {
                        movieNameCutToFit: `${movie.Title.slice(0, 17)}...`,
                    }),
                    movieReleaseYear: movie.Year,
                    movieRuntime: movieRuntime,
                    imdbRating: movie.imdbRating,
                    hrefPoster: movie.Poster,
                    moviePlot: movie.Plot,
                    movieGenres: movie.Genre,
                    timeToClose: new Date(startTime.getTime() + movieRuntime * 60000 + 900000),
                },
                { maxEventsPerOwner: limits.maxEventsPerOwner }
            );
        } catch (error) {
            if (error instanceof theaters.OwnerConflictError) {
                sendError(res, "CONFLICT", "You already have an ongoing event");
                return;
            }
            if (error instanceof theaters.NoFreeSlotError) {
                req.log.error({ err: error }, "Gave up allocating a theater slot");
                sendError(res, "UNAVAILABLE", "The strip is busy right now, try again");
                return;
            }
            throw error;
        }

        // The key is returned once, to the host, so they have something to
        // share; it is projected out of every listing and never retrievable
        // again. The id comes with it because a link needs both halves.
        res.status(200).send({
            message: "Event Created",
            theaterId: created.insertedId.toString(),
            ...(lobbyKey && { lobbyKey }),
        });
    }
);

router.patch(
    "/theaters/:id",
    validateBody(joinTheaterSchema),
    loadTheater("Failed to join theater"),
    async (req, res) => {
        const theater = req.theater;
        const clientUser = req.body;
        const sessionUserId = req.session.userID?.toString();

        if (!sessionUserId || clientUser.userID !== sessionUserId) {
            sendError(res, "UNAUTHENTICATED", "Must be logged in to join theater");
            return;
        }

        if (theater.isPrivate) {
            // timingSafeEqual needs equal lengths, and the key length is fixed
            // and public, so a length mismatch is simply a wrong key.
            const supplied = Buffer.from(clientUser.lobbyKey ?? "", "utf8");
            const expected = Buffer.from(theater.lobbyKey ?? "", "utf8");
            if (
                supplied.length !== expected.length ||
                !crypto.timingSafeEqual(supplied, expected)
            ) {
                sendError(res, "FORBIDDEN", "That link is not valid for this event");
                return;
            }
        } else if (theater.passwordBool) {
            // Theaters created before lobby keys existed. They expire within
            // hours of their showing, so this branch and the `password` field on
            // joinTheaterSchema come out once none can still be live — but until
            // then, removing it would break someone's evening mid-event.
            //
            // bcrypt.compare throws on a non-string, so a join that omits the
            // password entirely turned a malformed request into a 500.
            if (
                typeof clientUser.password !== "string" ||
                !(await bcrypt.compare(clientUser.password, theater.password))
            ) {
                sendError(res, "FORBIDDEN", "Password doesn't match");
                return;
            }
        }

        const occupants = await theaters.occupantsOf(theater);
        if (occupants.length >= theater.amountOfSpaces) {
            sendError(res, "CONFLICT", "Theater is full");
            return;
        }
        if (occupants.some((occupant) => occupant.userID === sessionUserId)) {
            sendError(res, "CONFLICT", "You are already inside the theater");
            return;
        }

        await theaters.addOccupant(theater._id, sessionUserId);
        req.session.theater = theater._id.toString();
        res.status(200).send({ message: "Successfully joined lobby" });
    }
);

router.delete("/theaters/:id", loadTheater("Failed to delete theater"), async (req, res) => {
    const theater = req.theater;
    const sessionUserId = req.session.userID?.toString();

    if (!sessionUserId || theater.ownerID.toString() !== sessionUserId) {
        sendError(res, "FORBIDDEN", "Only the owner can delete the theater");
        return;
    }

    const occupants = await theaters.occupantsOf(theater);
    if (occupants.length > 1 || !occupants.some((occupant) => occupant.userID === sessionUserId)) {
        sendError(res, "CONFLICT", "Owner must be the only one inside the theater");
        return;
    }

    await theaters.deleteTheater(theater._id);
    res.send({ message: "Theater successfully deleted" });
});

export default router;

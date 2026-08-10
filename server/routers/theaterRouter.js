import { Router } from "express";
import db from "../database/createConnection.js";
import { ObjectId } from "mongodb";
import "dotenv/config";
import bcrypt from "bcrypt";
import { liveOccupants } from "../socketios/presence.js";
const router = Router();

/**
 * Delete theaters whose closing time has passed.
 *
 * `timeToClose` was written when a theater was created and never read again, so
 * closed events accumulated forever — holding their slot on the strip and, via
 * the one-event-per-owner rule, permanently blocking their owner from creating
 * another. See defect C6.
 *
 * This is a lazy sweep rather than a scheduled job: the listing is hit on every
 * page load, which is a good enough trigger for an app this size and avoids
 * standing up a scheduler. The field is indexed.
 */
/**
 * The lowest slot number no live theater occupies.
 *
 * The old walk reassigned the candidate on every mismatch without breaking and
 * then fell back on `if (!theater.position)`, which cannot tell slot 0 from an
 * unset slot. See defect C3.
 */
// A slot conflict means another request won the gap between reading the list
// and inserting. Retrying recomputes against the new state; the cap is there so
// a genuinely full strip fails rather than spins.
const MAX_SLOT_ATTEMPTS = 10;
const DUPLICATE_KEY = 11000;

function firstFreeSlot(theaters) {
    const taken = new Set(theaters.map((theater) => theater.position));
    let slot = 0;
    while (taken.has(slot)) {
        slot++;
    }
    return slot;
}

/**
 * Drop occupants who are no longer there.
 *
 * An occupant is added by the HTTP join and removed by the socket's disconnect
 * handler, so anything that breaks that pairing leaves a ghost holding a seat
 * for the life of the theater — a tab closed before the socket opened, a
 * dropped connection, a restart that clears every socket at once. The stored
 * list is reconciled against the live room instead of trusted. See defect C5.
 *
 * The grace period is what makes this safe: the join and the socket handshake
 * are two round trips, so someone who has only just joined has no socket yet
 * and must not be swept. Entries stored in the old bare-string format have no
 * join time at all and sweep on first contact, which is the intent — they
 * predate any socket this process knows about.
 */
const OCCUPANT_GRACE_MS = 60 * 1000;

async function reconcileOccupants(theater) {
    const stored = theater.usersInsideTheater ?? [];
    const live = await liveOccupants(theater._id.toString());
    if (live === null) {
        return stored;
    }

    const joinedSince = Date.now() - OCCUPANT_GRACE_MS;
    const present = stored.filter(
        (occupant) =>
            live.has(occupant?.userID) || new Date(occupant?.joinedAt ?? 0).getTime() > joinedSince
    );

    if (present.length !== stored.length) {
        await db.theaters.updateOne(
            { _id: theater._id },
            { $set: { usersInsideTheater: present } }
        );
    }
    return present;
}

async function removeExpiredTheaters(log) {
    try {
        await db.theaters.deleteMany({ timeToClose: { $lt: new Date() } });
    } catch (error) {
        // A failed sweep must not fail the request it was riding on.
        log.error({ err: error }, "Failed to remove expired theaters");
    }
}

router.get("/theaters", async (req, res) => {
    await removeExpiredTheaters(req.log);

    // The listing is public so events can be browsed before signing up, but
    // ownerID is not needed by any client view and should not be exposed.
    // See defect S8.
    const theaters = await db.theaters
        .find({}, { projection: { password: 0, ownerID: 0 } })
        .toArray();

    for (const theater of theaters) {
        theater.usersInsideTheater = await reconcileOccupants(theater);
    }
    res.status(200).send({ data: theaters });
});

router.get("/theaters/:id", async (req, res) => {
    if (!req.session.loggedIn) {
        return res.status(400).send({ message: "Must be logged in" });
    }
    if (!ObjectId.isValid(req.params.id)) {
        return res.status(400).send({ message: "Invalid theater" });
    }

    try {
        const theater = await db.theaters.findOne(
            { _id: new ObjectId(req.params.id) },
            { projection: { password: 0 } }
        );
        if (theater === null) {
            return res.status(404).send({ message: "Theater not found" });
        }
        return res.status(200).send({ data: theater });
    } catch (error) {
        req.log.error({ err: error }, "Failed to load theater");
        return res.status(500).send({ message: "Failed to load theater" });
    }
});

router.post("/theaters", async (req, res) => {
    if (!req.session.loggedIn) {
        res.status(400).send({ message: "Must be logged in to create a new event" });
        return;
    }
    const theater = req.body.data ?? {};

    if (!theater.eventName || !theater.startTime || !theater.amountOfSpaces) {
        res.status(400).send({ message: "All fields must be filled" });
        return;
    }
    if (theater.passwordBool) {
        if (theater.password.length < 8 || theater.password.length > 24) {
            res.status(400).send({ message: "Password must be between 8 and 24 characters" });
            return;
        }
    } else {
        theater.password = "";
    }
    if (theater.eventName.length > 18 || theater.eventName.length < 3) {
        res.status(400).send({ message: "Event name must be between 3 and 18 characters" });
        return;
    }
    if (!theater.imdbID) {
        res.status(400).send({ message: "Must choose a movie" });
        return;
    }
    if (!theater.startTime) {
        res.status(400).send({ message: "Must choose a time" });
        return;
    }
    if (theater.amountOfSpaces > 99 || theater.amountOfSpaces < 1) {
        res.status(400).send({ message: "Amount of spaces must be between 1 and 99" });
        return;
    }
    let startTime = new Date(theater.startTime);
    if (startTime.getTime() < new Date().getTime()) {
        startTime = new Date(startTime.getTime() + 86400000);
    }
    if (
        startTime.getTime() > new Date().getTime() + 86400000 ||
        startTime.getTime() < new Date().getTime()
    ) {
        res.status(400).send({ message: "Time must be within 24 hours" });
        return;
    }
    await removeExpiredTheaters(req.log);

    const theaters = await db.theaters.find().toArray();

    const sessionUserId = req.session.userID.toString();
    if (theaters.some((theater) => theater.ownerID.toString() === sessionUserId)) {
        res.status(400).send({ message: "You already have an ongoing event" });
        return;
    }

    if (!process.env.OMDB_API_KEY) {
        req.log.error("Movie API request failed: OMDB_API_KEY is not configured");
        return res.status(503).send({ message: "Movie search is not configured" });
    }

    const movieApiUrl = new URL("https://www.omdbapi.com/");
    movieApiUrl.searchParams.set("apikey", process.env.OMDB_API_KEY);
    movieApiUrl.searchParams.set("r", "json");
    movieApiUrl.searchParams.set("i", theater.imdbID);

    let response;
    let result;

    try {
        response = await fetch(movieApiUrl, {
            signal: AbortSignal.timeout(10000),
        });
        result = await response.json();
    } catch (error) {
        req.log.error(
            { name: error.name, code: error.code || error.cause?.code },
            "Movie API request failed"
        );
        return res.status(502).send({ message: "Movie details are temporarily unavailable" });
    }

    if (!response.ok) {
        req.log.error(
            { status: response.status, reason: result.Error || `HTTP ${response.status}` },
            "Movie API request failed"
        );
        return res.status(502).send({ message: "Movie details are temporarily unavailable" });
    }

    if (result.Response === "False") {
        res.status(400).send({ message: result.Error });
        return;
    }

    const movieRuntime = Number(result.Runtime.split(" ")[0]);

    // Built field by field rather than from req.body.data. The old code
    // stored the request body itself and overwrote the fields it cared
    // about, so anything the client invented — a slot, an imdbRating, an
    // _id — was persisted verbatim wherever the handler happened not to
    // write over it. See defect C3.
    const document = {
        eventName: theater.eventName,
        startTime,
        amountOfSpaces: theater.amountOfSpaces,
        imdbID: theater.imdbID,
        passwordBool: Boolean(theater.passwordBool),
        password: theater.passwordBool ? await bcrypt.hash(theater.password, 12) : "",
        ownerID: sessionUserId,
        usersInsideTheater: [],
        movieName: result.Title,
        // Spread rather than set to undefined: the driver stores undefined
        // as null, and the field was previously absent for short titles.
        ...(result.Title.length > 18 && {
            movieNameCutToFit: `${result.Title.slice(0, 17)}...`,
        }),
        movieReleaseYear: result.Year,
        movieRuntime: movieRuntime,
        imdbRating: result.imdbRating,
        hrefPoster: result.Poster,
        moviePlot: result.Plot,
        movieGenres: result.Genre,
        timeToClose: new Date(startTime.getTime() + movieRuntime * 60000 + 900000),
    };

    // Both uniqueness rules — one live event per owner, one theater per slot —
    // are now enforced by unique indexes, because two overlapping requests read
    // the same list and reach the same conclusion. The owner conflict is final;
    // a slot conflict just means someone else took the gap first, so recompute
    // and try the next one. See defect C4.
    for (let attempt = 0; attempt < MAX_SLOT_ATTEMPTS; attempt++) {
        const occupied = await db.theaters.find({}, { projection: { position: 1 } }).toArray();

        try {
            await db.theaters.insertOne({ ...document, position: firstFreeSlot(occupied) });
            res.status(200).send({ message: "Event Created" });
            return;
        } catch (error) {
            if (error.code !== DUPLICATE_KEY) {
                throw error;
            }
            if (error.keyPattern?.ownerID) {
                res.status(400).send({ message: "You already have an ongoing event" });
                return;
            }
        }
    }

    req.log.error({ attempts: MAX_SLOT_ATTEMPTS }, "Gave up allocating a theater slot");
    res.status(503).send({ message: "The strip is busy right now, try again" });
});

router.patch("/theaters/:id", async (req, res) => {
    const id = req.params.id;
    const clientUser = req.body;
    let theater;

    if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid theater" });
    }

    try {
        theater = await db.theaters.findOne({ _id: new ObjectId(id) });
    } catch (error) {
        req.log.error({ err: error }, "Failed to load theater for update");
        return res.status(500).send({ message: "Failed to join theater" });
    }

    if (theater === null) {
        res.status(400).send({ message: "Invalid theater" });
        return;
    }

    if (clientUser.joining) {
        const sessionUserId = req.session.userID?.toString();
        if (
            !clientUser.userID ||
            !sessionUserId ||
            clientUser.userID.toString() !== sessionUserId
        ) {
            res.status(400).send({ message: "Must be logged in to join theater" });
            return;
        }
        if (theater.passwordBool) {
            if (!(await bcrypt.compare(clientUser.password, theater.password))) {
                res.status(400).send({ message: "Password doesn't match" });
                return;
            }
        }
        const occupants = await reconcileOccupants(theater);
        if (occupants.length >= theater.amountOfSpaces) {
            res.status(400).send({ message: "Theater is full" });
            return;
        }
        if (occupants.some((occupant) => occupant.userID === sessionUserId)) {
            res.status(400).send({ message: "You are already inside the theater" });
            return;
        }

        await db.theaters.updateOne(
            { _id: new ObjectId(id), "usersInsideTheater.userID": { $ne: sessionUserId } },
            { $push: { usersInsideTheater: { userID: sessionUserId, joinedAt: new Date() } } }
        );
        req.session.theater = theater._id.toString();
        return res.status(200).send({ message: "Successfully joined lobby" });
    }

    return res.status(400).send({ message: "Unsupported theater update" });
});

router.delete("/theaters/:id", async (req, res) => {
    const id = req.params.id;
    let theater;

    if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid theater" });
    }

    try {
        theater = await db.theaters.findOne({ _id: new ObjectId(id) });
    } catch (error) {
        req.log.error({ err: error }, "Failed to load theater for deletion");
        return res.status(500).send({ message: "Failed to delete theater" });
    }
    if (theater === null) {
        res.status(400).send({ message: "No theater found" });
        return;
    }
    const sessionUserId = req.session.userID?.toString();
    if (!sessionUserId || theater.ownerID.toString() !== sessionUserId) {
        res.status(400).send({ message: "Only the owner can delete the theater" });
        return;
    }
    const occupants = await reconcileOccupants(theater);
    if (occupants.length > 1 || !occupants.some((occupant) => occupant.userID === sessionUserId)) {
        res.status(400).send({ message: "Owner must be the only one inside the theater" });
        return;
    }

    await db.theaters.deleteOne({ _id: new ObjectId(id) });
    res.send({ message: "Theater successfully deleted" });
});

export default router;

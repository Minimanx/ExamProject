import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { seedTheater } from "./helpers.js";

// Phase 3 exit criterion: two people can find each other by search. The strip is
// small enough today that the client could filter the whole list itself, but
// that is an accident of scale rather than a design, so the query does it.
const listing = (query = "") => request(app).get(`/theaters${query}`);
const names = (response) => response.body.data.map((theater) => theater.eventName).sort();

describe("GET /theaters search", () => {
    async function seedStrip() {
        await seedTheater({ eventName: "Noir Evening", movieName: "Chinatown" });
        await seedTheater({ eventName: "Sci-Fi Fest", movieName: "Blade Runner" });
        await seedTheater({ eventName: "Comedy Hour", movieName: "The Big Lebowski" });
    }

    it("returns everything when no search is given", async () => {
        await seedStrip();

        expect(names(await listing())).toEqual(["Comedy Hour", "Noir Evening", "Sci-Fi Fest"]);
    });

    it("matches on the event name", async () => {
        await seedStrip();

        expect(names(await listing("?q=noir"))).toEqual(["Noir Evening"]);
    });

    // People search for the film, not for whatever the host called the evening.
    it("matches on the movie name", async () => {
        await seedStrip();

        expect(names(await listing("?q=blade"))).toEqual(["Sci-Fi Fest"]);
    });

    it("ignores case", async () => {
        await seedStrip();

        expect(names(await listing("?q=CHINATOWN"))).toEqual(["Noir Evening"]);
    });

    it("matches a word in the middle of a title", async () => {
        await seedStrip();

        expect(names(await listing("?q=lebowski"))).toEqual(["Comedy Hour"]);
    });

    // A search box sends whatever is typed. A regular expression built from that
    // string turns "(" into a syntax error and ".*" into a match-everything.
    it.each(["(", "[a-", "*", ".*", "\\\\"])("survives %s as a search term", async (term) => {
        await seedStrip();

        const response = await listing(`?q=${encodeURIComponent(term)}`);

        expect(response.status).toBe(200);
    });

    it("treats a regex metacharacter as a literal, not a pattern", async () => {
        await seedTheater({ eventName: "Dot Night", movieName: "2001: A Space Odyssey" });

        expect(names(await listing("?q=.%2A"))).toEqual([]);
    });

    it("returns nothing rather than everything when nothing matches", async () => {
        await seedStrip();

        expect(names(await listing("?q=nosuchfilm"))).toEqual([]);
    });

    it("ignores surrounding whitespace", async () => {
        await seedStrip();

        expect(names(await listing("?q=%20%20noir%20%20"))).toEqual(["Noir Evening"]);
    });
});

describe("GET /theaters filters", () => {
    it("hides full theaters when hasSpace is set", async () => {
        await seedTheater({
            eventName: "Full House",
            amountOfSpaces: 1,
            usersInsideTheater: [{ userID: "someone", joinedAt: new Date() }],
        });
        await seedTheater({ eventName: "Room To Spare", amountOfSpaces: 10 });

        expect(names(await listing("?hasSpace=true"))).toEqual(["Room To Spare"]);
    });

    it("shows full theaters when hasSpace is not set", async () => {
        await seedTheater({
            eventName: "Full House",
            amountOfSpaces: 1,
            usersInsideTheater: [{ userID: "someone", joinedAt: new Date() }],
        });

        expect(names(await listing())).toEqual(["Full House"]);
    });

    it("keeps only theaters starting inside the window", async () => {
        await seedTheater({ eventName: "Soon", startTime: new Date(Date.now() + 600000) });
        await seedTheater({ eventName: "Later", startTime: new Date(Date.now() + 7200000) });

        expect(names(await listing("?startingWithin=30"))).toEqual(["Soon"]);
    });

    // An event already under way is not "starting within" anything, but it is
    // the one you are most likely to want to walk into.
    it("keeps an event that has already started", async () => {
        await seedTheater({ eventName: "Underway", startTime: new Date(Date.now() - 600000) });

        expect(names(await listing("?startingWithin=30"))).toEqual(["Underway"]);
    });

    it("combines a search with a filter", async () => {
        await seedTheater({
            eventName: "Noir Evening",
            amountOfSpaces: 1,
            usersInsideTheater: [{ userID: "someone", joinedAt: new Date() }],
        });
        await seedTheater({ eventName: "Noir Matinee", amountOfSpaces: 10 });

        expect(names(await listing("?q=noir&hasSpace=true"))).toEqual(["Noir Matinee"]);
    });

    it.each(["nonsense", "-1", "0"])("rejects %s as a window", async (value) => {
        const response = await listing(`?startingWithin=${value}`);

        expect(response.status).toBe(400);
        expect(response.body.code).toBe("VALIDATION_FAILED");
    });
});

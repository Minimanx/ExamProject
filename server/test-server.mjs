// Boots the real server against an in-memory MongoDB and seeds a small world.
// Used by the client's Playwright suite and handy for manual UI work; it is
// never part of a production build.
import { MongoMemoryServer } from "mongodb-memory-server";

const mongo = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongo.getUri();
process.env.SESSION_SECRET = "test-session-secret-at-least-32-chars";
process.env.CLIENT_ORIGINS = process.env.CLIENT_ORIGINS || "http://localhost:8123";
process.env.OMDB_API_KEY = "test-omdb-key";
// Blank the mail credentials so this can never authenticate against a real
// SMTP server. dotenv would otherwise pick up a populated server/.env and the
// e2e suite would send live email from the production account on every signup.
process.env.EMAIL_USER = "";
process.env.EMAIL_PASSWORD = "";

// Stub OMDB. The routers call the global fetch (node-fetch was removed in
// Phase 0.2), so the whole outbound path can be intercepted here — a client
// test cannot stub a call the server makes.
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (!url.includes("omdbapi.com")) return realFetch(input, init);

    const query = new URL(url).searchParams;
    const body = query.get("i")
        ? {
              Response: "True",
              Title: "Interstellar",
              Year: "2014",
              Runtime: "169 min",
              imdbRating: "8.7",
              Poster: "https://example.com/poster.jpg",
              Plot: "A test plot.",
              Genre: "Sci-Fi",
          }
        : {
              Response: "True",
              Search: [{ Title: "Interstellar", Year: "2014", imdbID: "tt0816692", Poster: "N/A" }],
          };

    return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
};

const { server } = await import("./app.js");
const db = (await import("./database/createConnection.js")).default;

const now = Date.now();
await db.theaters.insertMany(
    [0, 1, 2].map((i) => ({
        eventName: ["Movie Night", "Sci-Fi Fest", "Noir Evening"][i],
        startTime: new Date(now + 3600000),
        timeToClose: new Date(now + 10800000),
        amountOfSpaces: 10,
        position: i,
        // Distinct: theaters.ownerID carries a unique index — one live event
        // per owner — so a shared value silently fails the index build and the
        // fixture runs without the guarantee it is meant to exercise.
        ownerID: `${i + 1}`.padStart(24, "0"),
        usersInsideTheater: [],
        passwordBool: false,
        password: "",
        imdbID: "tt000000" + i,
        movieName: ["The Matrix", "Blade Runner", "Chinatown"][i],
        movieRuntime: 136,
        movieReleaseYear: "1999",
        imdbRating: "8.7",
        hrefPoster: "",
        moviePlot: "",
        movieGenres: "Action",
    }))
);

const port = Number(process.env.PORT) || 5055;
server.listen(port, () => console.log(`test server ready on ${port}`));

for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, async () => {
        server.close();
        await mongo.stop();
        process.exit(0);
    });
}

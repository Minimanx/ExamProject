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

const { server } = await import("./app.js");
const db = (await import("./database/createConnection.js")).default;

const now = Date.now();
await db.theaters.insertMany([0, 1, 2].map((i) => ({
    eventName: ["Movie Night", "Sci-Fi Fest", "Noir Evening"][i],
    startTime: new Date(now + 3600000),
    timeToClose: new Date(now + 10800000),
    amountOfSpaces: 10,
    position: i,
    ownerID: "000000000000000000000001",
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
})));

const port = Number(process.env.PORT) || 5055;
server.listen(port, () => console.log(`test server ready on ${port}`));

for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, async () => {
        server.close();
        await mongo.stop();
        process.exit(0);
    });
}

import { Router } from "express";
import db from "../database/createConnection.js";
import { ObjectId } from "mongodb";
import fetch from "node-fetch";
import "dotenv/config";
import bcrypt from "bcrypt";
const router = Router();

router.get("/theaters", async (req, res) => {
    const theaters = await db.theaters.find({}, { projection: { password: 0 }}).toArray();
    res.status(200).send({ data: theaters });
});

router.get("/theaters/:id", async (req, res) => {
    if(!req.session.loggedIn) {
        return res.status(400).send({ message: "Must be logged in" });
    }
    if(!ObjectId.isValid(req.params.id)) {
        return res.status(400).send({ message: "Invalid theater" });
    }

    try {
        const theater = await db.theaters.findOne({ _id: new ObjectId(req.params.id) }, { projection: { password: 0 }});
        if(theater === null) {
            return res.status(404).send({ message: "Theater not found" });
        }
        return res.status(200).send({ data: theater });
    } catch (error) {
        console.error("Failed to load theater", { message: error.message });
        return res.status(500).send({ message: "Failed to load theater" });
    }
    
});

router.post("/theaters", async (req, res) => {
    if(!req.session.loggedIn) {
        res.status(400).send({ message: "Must be logged in to create a new event" });
        return;
    }
    if(!req.session.creatingEvent) {
        req.session.creatingEvent = true;

        let theater = req.body.data;
    
        if(!theater.eventName || !theater.startTime || !theater.amountOfSpaces) {
            req.session.creatingEvent = false;
            res.status(400).send({ message: "All fields must be filled" });
            return;
        }
        if(theater.passwordBool) {
            if(theater.password.length < 8 || theater.password.length > 24) {
                req.session.creatingEvent = false;
                res.status(400).send({ message: "Password must be between 8 and 24 characters" });
                return;
            }
        } else {
            theater.password = "";
        }
        if(theater.eventName.length > 18 || theater.eventName.length < 3) {
            req.session.creatingEvent = false;
            res.status(400).send({ message: "Event name must be between 3 and 18 characters" });
            return;
        }
        if(!theater.imdbID) {
            req.session.creatingEvent = false;
            res.status(400).send({ message: "Must choose a movie" });
            return;
        }
        if(!theater.startTime) {
            req.session.creatingEvent = false;
            res.status(400).send({ message: "Must choose a time" });
            return;
        }
        if(theater.amountOfSpaces > 99 || theater.amountOfSpaces < 1) {
            req.session.creatingEvent = false;
            res.status(400).send({ message: "Amount of spaces must be between 1 and 99" });
            return;
        }
        let startTime = new Date(theater.startTime);
        if(startTime.getTime() < new Date().getTime()) {
            startTime = new Date(startTime.getTime() + 86400000);
        }
        if(startTime.getTime() > new Date().getTime() + 86400000 || startTime.getTime() < new Date().getTime()) {
            req.session.creatingEvent = false;
            res.status(400).send({ message: "Time must be within 24 hours" });
            return;
        }
        theater.startTime = startTime;

        const theaters = await db.theaters.find().toArray();

        const sessionUserId = req.session.userID.toString();
        if(theaters.some((theater) => theater.ownerID.toString() === sessionUserId)) {
            req.session.creatingEvent = false;
            res.status(400).send({ message: "You already have an ongoing event" });
            return;
        }
    
        if(!process.env.OMDB_API_KEY) {
            req.session.creatingEvent = false;
            console.error("Movie API request failed: OMDB_API_KEY is not configured");
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
                signal: AbortSignal.timeout(10000)
            });
            result = await response.json();
        } catch (error) {
            req.session.creatingEvent = false;
            console.error("Movie API request failed", {
                name: error.name,
                code: error.code || error.cause?.code
            });
            return res.status(502).send({ message: "Movie details are temporarily unavailable" });
        }

        if(!response.ok) {
            req.session.creatingEvent = false;
            console.error("Movie API request failed", {
                status: response.status,
                message: result.Error || `HTTP ${response.status}`
            });
            return res.status(502).send({ message: "Movie details are temporarily unavailable" });
        }
    
        if(result.Response === "False") {
            req.session.creatingEvent = false;
            res.status(400).send({ message: result.Error });
            return;
        }
    
        theater.movieName = result.Title;
        if(theater.movieName.length > 18) {
            theater.movieNameCutToFit = theater.movieName.slice(0, 17);
            theater.movieNameCutToFit += "...";
        }
        theater.movieReleaseYear = result.Year;
        theater.movieRuntime = Number(result.Runtime.split(" ")[0]);
        theater.imdbRating = result.imdbRating;
        theater.hrefPoster = result.Poster;
        theater.moviePlot = result.Plot;
        theater.movieGenres = result.Genre;
        theater.timeToClose = new Date(startTime.getTime() + (theater.movieRuntime * 60000) + 900000);
        
        let count = 0;
        theaters.sort((a, b) => a.position - b.position);
        for (let i = 0; i < theaters.length; i++) {
            if(theaters[i].position === count) {
                count++;
            } else {
                theater.position = count;
            }
        }
        if(!theater.position) {
            theater.position = count;
        }
    
        theater.ownerID = sessionUserId;
        theater.usersInsideTheater = [];
        if(theater.passwordBool) {
            theater.password = await bcrypt.hash(theater.password, 12);
        }
        
        await db.theaters.insertOne(theater);
        req.session.creatingEvent = false;
        res.status(200).send({ message: "Event Created"});
    } else {
        res.status(400).send({ message: "Already creating an event"});
    }
    
});

router.patch("/theaters/:id", async (req, res) => {
    const id = req.params.id;
    const clientUser = req.body;
    let theater;

    if(!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid theater" });
    }

    try {
        theater = await db.theaters.findOne({ _id: new ObjectId(id) });
    } catch (error) {
        console.error("Failed to load theater for update", { message: error.message });
        return res.status(500).send({ message: "Failed to join theater" });
    }

    if(theater === null) {
        res.status(400).send({ message: "Invalid theater" });
        return;
    }

    if(clientUser.joining) {
        const sessionUserId = req.session.userID?.toString();
        if(!clientUser.userID || !sessionUserId || clientUser.userID.toString() !== sessionUserId) {
            res.status(400).send({ message: "Must be logged in to join theater" });
            return;
        }
        if(theater.passwordBool) {
            if(!await bcrypt.compare(clientUser.password, theater.password)) {
                res.status(400).send({ message: "Password doesn't match" });
                return;
            }
        }
        if(theater.usersInsideTheater.length >= theater.amountOfSpaces) {
            res.status(400).send({ message: "Theater is full" });
            return;
        }
        if(theater.usersInsideTheater.some((user) => user.toString() === sessionUserId)) {
            res.status(400).send({ message: "You are already inside the theater" });
            return;
        }
        
        await db.theaters.updateOne({ _id: new ObjectId(id) }, { $addToSet: { usersInsideTheater: sessionUserId }});
        req.session.theater = theater._id.toString();
        return res.status(200).send({ message: "Successfully joined lobby" });
    }

    return res.status(400).send({ message: "Unsupported theater update" });
});

router.delete("/theaters/:id", async (req, res) => {
    const id = req.params.id;
    let theater;

    if(!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid theater" });
    }

    try {
        theater = await db.theaters.findOne({ _id: new ObjectId(id) });
    } catch (error) {
        console.error("Failed to load theater for deletion", { message: error.message });
        return res.status(500).send({ message: "Failed to delete theater" });
    }
    if(theater === null) {
        res.status(400).send({ message: "No theater found" });
        return;
    }
    const sessionUserId = req.session.userID?.toString();
    if(!sessionUserId || theater.ownerID.toString() !== sessionUserId) {
        res.status(400).send({ message: "Only the owner can delete the theater" });
        return;
    }
    if(theater.usersInsideTheater.length > 1 || !theater.usersInsideTheater.some((user) => user.toString() === sessionUserId)) {
        res.status(400).send({ message: "Owner must be the only one inside the theater" });
        return;
    }

    await db.theaters.deleteOne({ _id: new ObjectId(id) });
    res.send({ message: "Theater successfully deleted"});
});

export default router;

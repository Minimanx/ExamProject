import { Router } from "express";
import db from "../database/createConnection.js";
import { ObjectId } from "mongodb";
import fetch from "node-fetch";
import "dotenv/config";
import bcrypt from "bcrypt";
const router = Router();

router.get("/theaters", async (req, res) => {
    const theaters = await db.theaters.find({}, { projection: { password:0 }}).toArray();
    res.send({ data: theaters });
});

router.get("/theaters/:id", async (req, res) => {
    if(!req.session.loggedIn) {
        res.status(400).send({ message: "Must be logged in" });
        return;
    }
    const theater = await db.theaters.findOne({ _id: ObjectId(req.params.id) }, { projection: { password:0 }});
    res.send({ data: theater });
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
            if(theater.password.length < 8) {
                req.session.creatingEvent = false;
                res.status(400).send({ message: "Password is too short" });
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

        const theaters = await db.theaters.find().toArray();

        if(theaters.some((theater) => theater.ownerID === req.session.userID)) {
            req.session.creatingEvent = false;
            res.status(400).send({ message: "You already have an ongoing event" });
            return;
        }
    
        const response = await fetch(`https://movie-database-alternative.p.rapidapi.com/?r=json&i=${theater.imdbID}`, {
            headers: {
              'X-RapidAPI-Host': 'movie-database-alternative.p.rapidapi.com',
              'X-RapidAPI-Key': process.env.MOVIE_API_KEY
            }
        });
        const result = await response.json();
    
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

        let startTime = new Date(new Date().toDateString() + " " + theater.startTime);
        if(startTime.getTime() < new Date().getTime()) {
            startTime = new Date(startTime.getTime() + 86400000);
        }
        if(startTime.getTime() > new Date().getTime() + 86400000 || startTime.getTime() < new Date().getTime()) {
            req.session.creatingEvent = false;
            res.status(400).send({ message: "Time must be within 24 hours" });
            return;
        }
        theater.startTime = startTime;
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
    
        theater.ownerID = req.session.userID;
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

    const theater = await db.theaters.findOne({ _id: ObjectId(id) });
    if(theater === null) {
        res.status(400).send({ message: "Invalid theater" });
        return;
    }

    if(clientUser.joining) {
        if(!clientUser.userID || !req.session.userID || clientUser.userID !== req.session.userID) {
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
        if(theater.usersInsideTheater.some((user) => user === req.session.userID)) {
            res.status(400).send({ message: "You are already inside the theater" });
            return;
        }
        
        await db.theaters.updateOne({ _id: ObjectId(id) }, { $push: { usersInsideTheater: req.session.userID }});
        req.session.theater = theater._id.toString();
        res.status(200).send({ message: "Successfully joined lobby" });
    }
});

router.delete("/theaters/:id", async (req, res) => {
    const id = req.params.id;
    const theater = await db.theaters.findOne({ _id: ObjectId(id) });

    if(theater === null) {
        res.status(400).send({ message: "No theater found" });
        return;
    }
    if(theater.ownerID !== req.session.userID) {
        res.status(400).send({ message: "Only the owner can delete the theater" });
        return;
    }
    if(theater.usersInsideTheater.length > 1 || !theater.usersInsideTheater.some((user) => user === req.session.userID)) {
        res.status(400).send({ message: "Owner must be the only one inside the theater" });
        return;
    }

    await db.theaters.deleteOne({ _id: ObjectId(id) });
    res.send({ message: "Theater successfully deleted"});
});

export default router;
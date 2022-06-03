import { Router } from "express";
import db from "../database/createConnection.js";
import { ObjectId } from "mongodb";
import fetch from "node-fetch";
import "dotenv/config";
const router = Router();

router.get("/theaters", async (req, res) => {
    const theaters = await db.theaters.find().toArray();
    res.send({ data: theaters });
});

router.post("/theaters", async (req, res) => {
    if(!req.session.loggedIn) {
        res.status(400).send({ message: "Must be logged in to create a new event"});
        return;
    }

    let theater = req.body.data;
    let count = 0;
    const theaters = await db.theaters.find().toArray();
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
    
    const response = await fetch(`https://movie-database-alternative.p.rapidapi.com/?r=json&i=${theater.imdbID}`, {
        headers: {
          'X-RapidAPI-Host': 'movie-database-alternative.p.rapidapi.com',
          'X-RapidAPI-Key': process.env.MOVIE_API_KEY
        }
    });
    const result = await response.json();

    theater.movieName = result.Title;
    theater.movieReleaseYear = result.Year;
    theater.movieRuntime = result.Runtime;
    theater.imdbRating = result.imdbRating;
    theater.hrefPoster = result.Poster;
    theater.owner = req.session.userID;
    

    await db.theaters.insertOne(theater);
    res.status(200).send({ message: "Posted :)"});
});

router.delete("/theaters/:id", async (req, res) => {
    const id = req.params.id;
    //CHECK USER YOU KNOW
    if(id !== "undefined") {
        const deletedTheater = await db.theaters.deleteOne({ "_id": ObjectId(id) });
        res.send({ message: "Deleted :)"});
    } else {
        res.send({ message: "not a number........."});
    }
    
});

export default router;
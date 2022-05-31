import { Router } from "express";
import fetch from "node-fetch";
import "dotenv/config";
const router = Router();

const settings = {
    headers: {
      'X-RapidAPI-Host': 'movie-database-alternative.p.rapidapi.com',
      'X-RapidAPI-Key': process.env.MOVIE_API_KEY
    }
  };

router.get("/movies", async (req, res) => {
    const response = await fetch(`https://movie-database-alternative.p.rapidapi.com/?s=${req.query.s}&r=json&page=1`, settings);
    const result = await response.json();
    res.send({ data: result });
});

export default router;
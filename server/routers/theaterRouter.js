import { Router } from "express";
import db from "../database/createConnection.js";
import { ObjectId } from "mongodb";
const router = Router();

router.get("/theaters", async (req, res) => {
    const theaters = await db.theaters.find().toArray();
    res.send({ data: theaters });
});

router.post("/theaters", async (req, res) => {
    const xCoord = req.body.data.x;
    await db.theaters.insertOne({ name: "My Theater Event", movie: "James Bond Movie", coords: { x: xCoord, y: 20} });
    res.send({ message: "Posted :)"});
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
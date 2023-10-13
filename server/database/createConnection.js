import { MongoClient, ServerApiVersion } from "mongodb";
import "dotenv/config";

// const uri = `mongodb://Minimanx:${process.env.DB_PASSWORD}@cluster0-shard-00-00.qicg0.mongodb.net:27017,cluster0-shard-00-01.qicg0.mongodb.net:27017,cluster0-shard-00-02.qicg0.mongodb.net:27017/?ssl=true&replicaSet=atlas-5hk8xp-shard-0&authSource=admin&retryWrites=true&w=majority`;

// const client = await MongoClient.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


const uri = `mongodb+srv://Minimanx:${process.env.DB_PASSWORD}@cluster0.qicg0.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const db = client.db("FlixDrive");

export default {
    theaters: db.collection("theaters"),
    users: db.collection("users")
}
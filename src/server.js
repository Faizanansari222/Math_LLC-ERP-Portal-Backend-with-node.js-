import dotenv from "dotenv";
import mongoose from "mongoose";
import { DB_NAME } from "./constants.js";
import connectDB from "./DB/index.js";
import { app } from "./app.js";

dotenv.config();

connectDB();

app.get("/users", (req, res) => {

});

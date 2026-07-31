import dotenv from "dotenv";
import mongoose from "mongoose";
import { DB_NAME } from "./constants.js";
import connectDB from "./DB/index.js";
import { app } from "./app.js";

dotenv.config();

connectDB();

app.get("/users", (req, res) => {
  const data = [
    { name: "John Doe", age: 30 },
    { name: "Jane Doe", age: 25 },
    { name: "Bob Smith", age: 40 },
    { name: "Alice Johnson", age: 35 },
  ];
  res.json(data);
});

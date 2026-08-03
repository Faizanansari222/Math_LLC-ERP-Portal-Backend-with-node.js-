import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";
import express from "express";
import { app } from "../app.js";

const connectDB = async () => {

  try {
    await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
    console.log("MongoDB connected");

    app.on("error", (e) => console.log(e.message));

    app.listen(process.env.PORT, () =>
      console.log(`Server is running on port ${process.env.PORT}`),
    );
  } catch (e) {
    console.log(e.message);
  }
};

export default connectDB;

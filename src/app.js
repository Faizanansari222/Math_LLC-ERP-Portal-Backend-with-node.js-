import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
const app = express();
app.use(express.json());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN, // must be exactly "http://localhost:5173"
    credentials: true,               // NOT "cridentials"
  }),
);
console.log(process.env.CORS_ORIGIN)
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

import userRouter from "./routes/user.routes.js";

app.use("/api/v1/users", userRouter);

export { app };

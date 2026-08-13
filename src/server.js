import dotenv from "dotenv";
dotenv.config();

import connectDB from "./DB/index.js";
import { app } from "./app.js";

const PORT = process.env.PORT || 3005;

connectDB()
  .then(() => {
    app.on("error", (err) => {
      console.error("Express app error:", err);
    });

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
  });
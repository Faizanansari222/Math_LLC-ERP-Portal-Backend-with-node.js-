import dotenv from "dotenv";
dotenv.config();

import { createServer } from "http";
import connectDB from "./DB/index.js";
import { app } from "./app.js";
import { initSocketIO } from "./services/socket.service.js";

const PORT = process.env.PORT || 3001;

// Create HTTP server from Express app
const httpServer = createServer(app);

// Initialize Socket.io
const io = initSocketIO(httpServer, app);

connectDB()
  .then(() => {
    app.on("error", (err) => {
      console.error("Express app error:", err);
    });

    httpServer.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`🔌 Socket.io server is ready`);
    });
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
  });
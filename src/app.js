  import "dotenv/config";
  import express from "express";
  import cors from "cors";
  import cookieParser from "cookie-parser";
  
  import performanceRouter from "./routes/performance.routes.js";
  const app = express();
  app.use(express.json());

  // CORS_ORIGIN is comma-separated so both the deployed frontend and local
  // dev origins can be allowed at once — a single-origin value still works.
  const allowedOrigins = (process.env.CORS_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  // Vite picks a different port whenever the usual one is busy (5173,
  // 5174, ...), and a browser sends a different Origin for `localhost`
  // vs `127.0.0.1` — both keep silently breaking CORS here. An Origin
  // header can't be spoofed cross-origin by another site (the browser
  // sets it to the real requesting page's origin), so it's safe to trust
  // any localhost/127.0.0.1 origin unconditionally, regardless of port.
  const isLocalDevOrigin = (origin) => {
    try {
      const { hostname } = new URL(origin);
      return hostname === "localhost" || hostname === "127.0.0.1";
    } catch {
      return false;
    }
  };

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || isLocalDevOrigin(origin)) {
          return callback(null, true);
        }
        callback(new Error(`Not allowed by CORS: ${origin}`));
      },
      credentials: true,
    }),
  );
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  import userRouter from "./routes/user.routes.js";
  import clientRouter from "./routes/client.routes.js";
  import projectRouter from "./routes/project.routes.js";
  import messageRouter from "./routes/message.routes.js";
  import notificationRouter from "./routes/notification.routes.js";
  import invitationRouter from "./routes/invitation.routes.js";

  app.use("/api/v1/users", userRouter);
  app.use("/api/v1/clients", clientRouter);
  app.use("/api/v1/projects", projectRouter);
  app.use("/api/v1/performance", performanceRouter);
  app.use("/api/v1/messages", messageRouter);
  app.use("/api/v1/notifications", notificationRouter);
  app.use("/api/v1/invitations", invitationRouter);

  export { app };

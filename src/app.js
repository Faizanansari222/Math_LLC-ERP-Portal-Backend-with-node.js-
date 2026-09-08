  import "dotenv/config";
  import express from "express";
  import cors from "cors";
  import cookieParser from "cookie-parser";
  
  import performanceRouter from "./routes/performance.routes.js";
  const app = express();
  app.use(express.json());
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN,
      credentials: true,
    }),
  );
  console.log(process.env.CORS_ORIGIN);
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

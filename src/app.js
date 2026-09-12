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
      // Passing `false` (not an Error) here matters: an Error thrown from
      // this callback has no error-handling middleware to catch it, so
      // Express falls back to its default HTML error page for a rejected
      // origin — a real 500, and one that happens *outside* this
      // middleware, so it never gets a CORS header attached either. A
      // disallowed origin should just fail the browser's own CORS check
      // (missing Access-Control-Allow-Origin), not crash the request.
      origin: (origin, callback) => {
        const isAllowed =
          !origin || allowedOrigins.includes(origin) || isLocalDevOrigin(origin);
        callback(null, isAllowed);
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

  // Safety net: every route already handles its own errors via
  // asyncHandler, so this only fires for something unexpected (a sync
  // throw outside a controller, a rejected promise nothing awaited,
  // etc.). Without this, such an error would fall through to Express's
  // default HTML error page — which, like the CORS bug above, responds
  // outside the normal middleware chain and would arrive at the browser
  // with no CORS headers at all, so it's the pre-flighted browser
  // request itself that would then fail even though the server sort-of
  // succeeded. This just makes sure every response, error or not, always
  // gets a plain JSON body with whatever CORS headers already applied.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(`[${req.method} ${req.originalUrl}] Unhandled error:`, err);
    res.status(err.status || 500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  });

  export { app };

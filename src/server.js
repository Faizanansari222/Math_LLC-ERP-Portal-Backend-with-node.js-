import dotenv from "dotenv";
dotenv.config();

import { createServer } from "http";
import connectDB from "./DB/index.js";
import { app } from "./app.js";
import { initSocketIO } from "./services/socket.service.js";
import { sendUpcomingDeadlineReminders } from "./services/deadlineReminder.service.js";

const PORT = process.env.PORT || 3001;
const DEADLINE_CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly is granular enough for a 24h-out reminder

// ============================================================
// Startup env check — this app sends all email via Resend (see
// src/config/mail.config.js); there is no Nodemailer/SMTP path, so
// EMAIL_HOST/EMAIL_USER/EMAIL_PASS are not applicable here. Warn loudly
// (without ever printing the actual key) if the vars email sending
// depends on are missing, or if EMAIL_FROM is still pointed at Resend's
// shared sandbox address — that address can only deliver to the
// Resend account owner's own email until a domain is verified.
// ============================================================
const checkEmailEnv = () => {
  if (!process.env.RESEND_API_KEY) {
    console.warn("⚠️  RESEND_API_KEY is not set — all outgoing email will fail.");
  }
  if (!process.env.EMAIL_FROM) {
    console.warn("⚠️  EMAIL_FROM is not set — all outgoing email will fail.");
  } else if (process.env.EMAIL_FROM.includes("resend.dev")) {
    console.warn(
      `⚠️  EMAIL_FROM ("${process.env.EMAIL_FROM}") is still using Resend's sandbox domain ` +
        "(resend.dev). Resend will reject sending to anyone except the account owner's own " +
        "email until a domain is verified at resend.com/domains and EMAIL_FROM is updated " +
        "to use that domain.",
    );
  }
};
checkEmailEnv();

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

    // Task deadline reminders — check on boot, then hourly
    const runDeadlineCheck = () => {
      sendUpcomingDeadlineReminders(io)
        .then((count) => {
          if (count > 0) console.log(`⏰ Sent ${count} deadline reminder notification(s)`);
        })
        .catch((err) => console.error("Deadline reminder check failed:", err.message));
    };
    runDeadlineCheck();
    setInterval(runDeadlineCheck, DEADLINE_CHECK_INTERVAL_MS);
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
  });
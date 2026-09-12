import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { User } from "../models/user.models.js";

// Store connected users: Map<userId, Set<socketId>>
const connectedUsers = new Map();

/**
 * Initialize Socket.io server with authentication
 * @param {import("http").Server} httpServer
 * @param {import("express").Express} app
 * @returns {Server}
 */
const initSocketIO = (httpServer, app) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN,
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // ========== AUTHENTICATION MIDDLEWARE ==========
  io.use(async (socket, next) => {
    try {
      // Accept token from handshake auth or query string
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.query?.token;

      if (!token) {
        return next(new Error("Authentication error: No token provided"));
      }

      // Verify the JWT token
      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

      // Fetch user from database
      const user = await User.findById(decoded._id).select(
        "-password -refreshToken"
      );

      if (!user) {
        return next(new Error("Authentication error: User not found"));
      }

      // Attach user to socket
      socket.user = user;
      next();
    } catch (error) {
      next(new Error("Authentication error: Invalid token"));
    }
  });

  // ========== CONNECTION HANDLER ==========
  io.on("connection", (socket) => {
    const userId = socket.user._id.toString();

    // Track connected user
    if (!connectedUsers.has(userId)) {
      connectedUsers.set(userId, new Set());
    }
    connectedUsers.get(userId).add(socket.id);

    // Notify the user they're connected
    socket.emit("connected", {
      message: "Connected to messaging server",
      userId,
    });

    // ========== JOIN USER'S PERSONAL ROOM ==========
    // Each user joins a room based on their ID for targeted notifications
    socket.join(`user:${userId}`);

    // ========== MESSAGING EVENTS ==========

    // Join a conversation room (1-on-1 chat)
    socket.on("join-conversation", (otherUserId) => {
      // Create a unique room name for the conversation
      const roomName = getConversationRoom(userId, otherUserId);
      socket.join(roomName);

      socket.emit("joined-conversation", { otherUserId, room: roomName });
    });

    // Leave a conversation room
    socket.on("leave-conversation", (otherUserId) => {
      const roomName = getConversationRoom(userId, otherUserId);
      socket.leave(roomName);
    });

   
    socket.on("mark-read", async (data) => {
      try {
        const { senderId } = data;
        const { Message } = await import("../models/message.models.js");

        await Message.updateMany(
          { sender: senderId, receiver: userId, read: false },
          { $set: { read: true, readAt: new Date() } }
        );

        // Notify the other user that messages were read
        io.to(`user:${senderId}`).emit("messages-read", {
          readBy: userId,
          readAt: new Date(),
        });

        socket.emit("read-confirmed", { senderId });

      } catch (error) {
        console.error("Error marking as read:", error);
        socket.emit("error", { message: "Failed to mark as read" });
      }
    });

    // ========== NOTIFICATION EVENTS ==========

    // Mark notification as read
    socket.on("mark-notification-read", async (data) => {
      try {
        const { notificationId } = data;
        const { Notification } = await import("../models/notification.models.js");

        const notification = await Notification.findOneAndUpdate(
          { _id: notificationId, recipient: userId },
          { $set: { read: true, readAt: new Date() } },
          { new: true }
        );

        if (notification) {
          socket.emit("notification-updated", notification);
        }

      } catch (error) {
        console.error("Error marking notification as read:", error);
        socket.emit("error", { message: "Failed to mark notification as read" });
      }
    });

    // Mark all notifications as read
    socket.on("mark-all-notifications-read", async () => {
      try {
        const { Notification } = await import("../models/notification.models.js");

        await Notification.updateMany(
          { recipient: userId, read: false },
          { $set: { read: true, readAt: new Date() } }
        );

        socket.emit("all-notifications-read");

      } catch (error) {
        console.error("Error marking all notifications as read:", error);
        socket.emit("error", { message: "Failed to mark all as read" });
      }
    });

    // ========== TYPING INDICATORS ==========

    socket.on("typing-start", (otherUserId) => {
      io.to(`user:${otherUserId}`).emit("user-typing", {
        userId,
        firstName: socket.user.firstName,
      });
    });

    socket.on("typing-stop", (otherUserId) => {
      io.to(`user:${otherUserId}`).emit("user-stopped-typing", {
        userId,
      });
    });

    // ========== ONLINE STATUS ==========

    // Get online status of specific users
    socket.on("get-online-status", (userIds) => {
      const statuses = userIds.map((id) => ({
        userId: id,
        online: connectedUsers.has(id),
      }));
      socket.emit("online-status", statuses);
    });

    // ========== DISCONNECT ==========
    socket.on("disconnect", (reason) => {
      console.log(`🔌 User disconnected: ${socket.user.firstName} (${socket.id}) - ${reason}`);

      const userSockets = connectedUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          connectedUsers.delete(userId);
        }
      }
    });
  });

  // Store io instance on app for use in controllers
  app.set("io", io);

  return io;
};

/**
 * Generate a consistent room name for a conversation between two users
 */
function getConversationRoom(userId1, userId2) {
  return `conversation:${[userId1, userId2].sort().join(":")}`;
}

/**
 * Helper: Check if a user is currently connected
 */
function isUserOnline(userId) {
  return connectedUsers.has(userId);
}

/**
 * Helper: Send notification to a specific user (used by controllers)
 */
function sendNotificationToUser(io, userId, notification) {
  if (io) {
    io.to(`user:${userId}`).emit("notification", notification);
  }
}

/**
 * Helper: Send message to a conversation room (used by controllers)
 */
function sendMessageToConversation(io, userId1, userId2, message) {
  if (io) {
    const roomName = getConversationRoom(userId1, userId2);
    io.to(roomName).emit("new-message", message);
  }
}

export {
  initSocketIO,
  connectedUsers,
  isUserOnline,
  sendNotificationToUser,
  sendMessageToConversation,
};

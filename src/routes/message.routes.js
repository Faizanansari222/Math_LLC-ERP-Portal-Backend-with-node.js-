import { Router } from "express";
import {
  sendMessage,
  getConversation,
  getAllConversations,
  getUnreadCount,
  markAsRead,
} from "../controllers/message.controllers.js";
import { verifyJWT } from "../middleware/auth.middleware.js";

const router = Router();

// All routes require authentication
router.use(verifyJWT);

// GET /api/v1/messages/conversations - list all conversations
router.get("/conversations", getAllConversations);

// GET /api/v1/messages/unread - get unread count
router.get("/unread", getUnreadCount);

// POST /api/v1/messages - send a message
router.post("/", sendMessage);

// GET /api/v1/messages/conversation/:userId - get conversation with a user
router.get("/conversation/:userId", getConversation);

// PATCH /api/v1/messages/read/:userId - mark messages from user as read
router.patch("/read/:userId", markAsRead);

export default router;

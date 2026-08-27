import { Router } from "express";
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from "../controllers/notification.controllers.js";
import { verifyJWT } from "../middleware/auth.middleware.js";

const router = Router();

// All routes require authentication
router.use(verifyJWT);

// GET /api/v1/notifications - get user notifications
router.get("/", getNotifications);

// PATCH /api/v1/notifications/read-all - mark all notifications as read
router.patch("/read-all", markAllNotificationsAsRead);

// PATCH /api/v1/notifications/:notificationId/read - mark notification as read
router.patch("/:notificationId/read", markNotificationAsRead);

// DELETE /api/v1/notifications/:notificationId - delete notification
router.delete("/:notificationId", deleteNotification);

export default router;

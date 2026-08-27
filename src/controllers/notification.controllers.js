import { Notification } from "../models/notification.models.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";

// ============================================================
// CREATE NOTIFICATION (internal helper used by other controllers)
// ============================================================
const createNotification = async ({ recipient, sender, type, title, message, entityType, entityId, io }) => {
  const notification = await Notification.create({
    recipient,
    sender,
    type,
    title,
    message,
    entityType,
    entityId,
  });

  // Send real-time notification via Socket.io if io instance is provided
  if (io) {
    io.to(`user:${recipient}`).emit("notification", notification);
  }

  return notification;
};

// ============================================================
// SEND NOTIFICATION TO USER (helper for socket service)
// ============================================================
const sendNotificationToUser = async (userId, notification, io) => {
  if (io) {
    io.to(`user:${userId}`).emit("notification", notification);
  }
};

// ============================================================
// GET USER NOTIFICATIONS
// GET /api/v1/notifications
// ============================================================
const getNotifications = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
  const skip = (page - 1) * limit;

  const { type, read } = req.query;
  const filter = { recipient: req.user._id };

  if (type) filter.type = type;
  if (read !== undefined) filter.read = read === "true";

  const [notifications, totalNotifications] = await Promise.all([
    Notification.find(filter)
      .populate("sender", "firstName lastName email userImage")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Notification.countDocuments(filter),
  ]);

  const unreadCount = await Notification.countDocuments({
    recipient: req.user._id,
    read: false,
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        notifications,
        unreadCount,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalNotifications / limit),
          totalNotifications,
          limit,
        },
      },
      "Notifications fetched successfully"
    )
  );
});

// ============================================================
// MARK NOTIFICATION AS READ
// PATCH /api/v1/notifications/:notificationId/read
// ============================================================
const markNotificationAsRead = asyncHandler(async (req, res) => {
  const { notificationId } = req.params;

  const notification = await Notification.findOneAndUpdate(
    {
      _id: notificationId,
      recipient: req.user._id,
    },
    { $set: { read: true, readAt: new Date() } },
    { new: true }
  );

  if (!notification) throw new ApiError(404, "Notification not found");

  // Emit updated notification via Socket.io
  const io = req.app.get("io");
  if (io) {
    io.to(`user:${req.user._id}`).emit("notification-updated", notification);
  }

  return res.status(200).json(
    new ApiResponse(200, notification, "Notification marked as read")
  );
});

// ============================================================
// MARK ALL NOTIFICATIONS AS READ
// PATCH /api/v1/notifications/read-all
// ============================================================
const markAllNotificationsAsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { recipient: req.user._id, read: false },
    { $set: { read: true, readAt: new Date() } }
  );

  // Emit confirmation via Socket.io
  const io = req.app.get("io");
  if (io) {
    io.to(`user:${req.user._id}`).emit("all-notifications-read");
  }

  return res.status(200).json(
    new ApiResponse(200, {}, "All notifications marked as read")
  );
});

// ============================================================
// DELETE NOTIFICATION
// DELETE /api/v1/notifications/:notificationId
// ============================================================
const deleteNotification = asyncHandler(async (req, res) => {
  const { notificationId } = req.params;

  const notification = await Notification.findOneAndDelete({
    _id: notificationId,
    recipient: req.user._id,
  });

  if (!notification) throw new ApiError(404, "Notification not found");

  // Emit deletion event via Socket.io
  const io = req.app.get("io");
  if (io) {
    io.to(`user:${req.user._id}`).emit("notification-deleted", {
      notificationId,
    });
  }

  return res.status(200).json(
    new ApiResponse(200, {}, "Notification deleted successfully")
  );
});

export {
  createNotification,
  sendNotificationToUser,
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
};

import { Message } from "../models/message.models.js";
import { User } from "../models/user.models.js";
import { Notification } from "../models/notification.models.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";

// ============================================================
// SEND MESSAGE
// POST /api/v1/messages
// ============================================================
const sendMessage = asyncHandler(async (req, res) => {
  const { receiverId, content } = req.body;

  if (!receiverId) throw new ApiError(400, "Receiver ID is required");
  if (!content?.trim()) throw new ApiError(400, "Message content is required");

  const receiver = await User.findById(receiverId);
  if (!receiver) throw new ApiError(404, "Receiver not found");

  if (receiverId === req.user._id.toString()) {
    throw new ApiError(400, "You cannot send a message to yourself");
  }

  const message = await Message.create({
    sender: req.user._id,
    receiver: receiverId,
    content: content.trim(),
  });

  const populatedMessage = await Message.findById(message._id)
    .populate("sender", "firstName lastName email userImage")
    .populate("receiver", "firstName lastName email userImage");

  // Emit real-time message via Socket.io
  const io = req.app.get("io");
  if (io) {
    // Create conversation room name (consistent with socket service)
    const roomName = `conversation:${[req.user._id.toString(), receiverId].sort().join(":")}`;

    // Emit to conversation room (both sender and receiver)
    io.to(roomName).emit("new-message", populatedMessage);

    // Also emit to receiver's personal room (for conversation list updates)
    io.to(`user:${receiverId}`).emit("message-received", {
      message: populatedMessage,
      from: {
        _id: req.user._id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
      },
    });

    // Send real-time notification to receiver
    const notification = await Notification.create({
      recipient: receiverId,
      sender: req.user._id,
      type: "message-received",
      title: "New Message",
      message: `You have a new message from ${req.user.firstName} ${req.user.lastName}`,
      entityType: "message",
      entityId: message._id,
    });

    io.to(`user:${receiverId}`).emit("notification", notification);
  } else {
    // Fallback: create notification without real-time (SSE)
    await Notification.create({
      recipient: receiverId,
      sender: req.user._id,
      type: "message-received",
      title: "New Message",
      message: `You have a new message from ${req.user.firstName} ${req.user.lastName}`,
      entityType: "message",
      entityId: message._id,
    });
  }

  return res.status(201).json(
    new ApiResponse(201, populatedMessage, "Message sent successfully")
  );
});

// ============================================================
// GET CONVERSATION BETWEEN TWO USERS
// GET /api/v1/messages/conversation/:userId
// ============================================================
const getConversation = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);
  const skip = (page - 1) * limit;

  const otherUser = await User.findById(userId);
  if (!otherUser) throw new ApiError(404, "User not found");

  const messages = await Message.find({
    $or: [
      { sender: req.user._id, receiver: userId },
      { sender: userId, receiver: req.user._id },
    ],
  })
    .populate("sender", "firstName lastName email userImage")
    .populate("receiver", "firstName lastName email userImage")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const totalMessages = await Message.countDocuments({
    $or: [
      { sender: req.user._id, receiver: userId },
      { sender: userId, receiver: req.user._id },
    ],
  });

  // Mark messages from the other user as read
  await Message.updateMany(
    { sender: userId, receiver: req.user._id, read: false },
    { $set: { read: true, readAt: new Date() } }
  );

  // Emit read receipt via Socket.io
  const io = req.app.get("io");
  if (io) {
    io.to(`user:${userId}`).emit("messages-read", {
      readBy: req.user._id,
      readAt: new Date(),
    });
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        messages: messages.reverse(), // Return in chronological order
        otherUser: {
          _id: otherUser._id,
          firstName: otherUser.firstName,
          lastName: otherUser.lastName,
          email: otherUser.email,
          userImage: otherUser.userImage,
        },
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalMessages / limit),
          totalMessages,
          limit,
        },
      },
      "Conversation fetched successfully"
    )
  );
});

// ============================================================
// GET ALL CONVERSATIONS (list of users you've chatted with)
// GET /api/v1/messages/conversations
// ============================================================
const getAllConversations = asyncHandler(async (req, res) => {
  const conversations = await Message.aggregate([
    {
      $match: {
        $or: [
          { sender: req.user._id },
          { receiver: req.user._id },
        ],
      },
    },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: {
          $cond: [
            { $eq: ["$sender", req.user._id] },
            "$receiver",
            "$sender",
          ],
        },
        lastMessage: { $first: "$$ROOT" },
        unreadCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$receiver", req.user._id] },
                  { $eq: ["$read", false] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" },
    {
      $project: {
        _id: 1,
        user: {
          _id: "$user._id",
          firstName: "$user.firstName",
          lastName: "$user.lastName",
          email: "$user.email",
          userImage: "$user.userImage",
          department: "$user.department",
        },
        lastMessage: {
          content: "$lastMessage.content",
          createdAt: "$lastMessage.createdAt",
          sender: "$lastMessage.sender",
        },
        unreadCount: 1,
      },
    },
    { $sort: { "lastMessage.createdAt": -1 } },
  ]);

  return res.status(200).json(
    new ApiResponse(200, conversations, "Conversations fetched successfully")
  );
});

// ============================================================
// GET UNREAD MESSAGE COUNT
// GET /api/v1/messages/unread
// ============================================================
const getUnreadCount = asyncHandler(async (req, res) => {
  const unreadCount = await Message.countDocuments({
    receiver: req.user._id,
    read: false,
  });

  // Get unread count per user
  const unreadByUser = await Message.aggregate([
    {
      $match: {
        receiver: req.user._id,
        read: false,
      },
    },
    {
      $group: {
        _id: "$sender",
        count: { $sum: 1 },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" },
    {
      $project: {
        userId: "$_id",
        firstName: "$user.firstName",
        lastName: "$user.lastName",
        count: 1,
      },
    },
  ]);

  return res.status(200).json(
    new ApiResponse(
      200,
      { totalUnread: unreadCount, unreadByUser },
      "Unread count fetched successfully"
    )
  );
});

// ============================================================
// MARK MESSAGES AS READ
// PATCH /api/v1/messages/read/:userId
// ============================================================
const markAsRead = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  await Message.updateMany(
    { sender: userId, receiver: req.user._id, read: false },
    { $set: { read: true, readAt: new Date() } }
  );

  // Emit read receipt via Socket.io
  const io = req.app.get("io");
  if (io) {
    io.to(`user:${userId}`).emit("messages-read", {
      readBy: req.user._id,
      readAt: new Date(),
    });
  }

  return res.status(200).json(
    new ApiResponse(200, {}, "Messages marked as read")
  );
});

export {
  sendMessage,
  getConversation,
  getAllConversations,
  getUnreadCount,
  markAsRead,
};

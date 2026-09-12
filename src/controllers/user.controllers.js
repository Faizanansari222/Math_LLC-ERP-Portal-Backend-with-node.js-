import crypto from "crypto";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  uploadOnCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.models.js";
import { sendPasswordResetEmail } from "../services/mail.service.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(500, error.message, "Something went wrong");
  }
};

const registerUser = asyncHandler(async (req, res) => {
  const {
    firstName,
    lastName,
    email,
    password,
    phone,
    department,
    experience,
    employeeStatus,
    role,
    userImage,
  } = req.body;

  if (
    [
      firstName,
      lastName,
      email,
      password,
      phone,
      department,
      experience,
      employeeStatus,
      role,
    ].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(409, "User already exists");
  }

  let profileImageUrl;
  const userImageLocalPath = req.files?.userImage?.[0]?.path;
  if (userImageLocalPath) {
    const profileImage = await uploadOnCloudinary(userImageLocalPath);
    profileImageUrl = profileImage?.url;
  }

  const user = await User.create({
    firstName,
    lastName,
    email,
    password,
    phone,
    department,
    experience,
    employeeStatus,
    role,
    userImage: profileImageUrl,
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken",
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while creating the user");
  }

  return res
    .status(201)
    .json(new ApiResponse(201, createdUser, "User created successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if ([email, password].some((field) => field?.trim() === "")) {
    throw new ApiError(400, "All fields are required");
  }

  const user = await User.findOne({ email }).select("+password");
  if (!user) throw new ApiError(404, "User not found");

  const isPasswordMatch = await user.isCorrectPassword(password);
  if (!isPasswordMatch) throw new ApiError(401, "Invalid credentials");

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id,
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken",
  );

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser, accessToken, refreshToken },
        "User logged in successfully",
      ),
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    { $unset: { refreshToken: 1 } },
    { new: true },
  );

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out successfully"));
});

// NOTE: this route must NEVER be behind verifyJWT.
// It's called precisely when the access token has already expired —
// verifyJWT would reject the request before this handler ever runs.
// Only the refresh token (read from the cookie below) is checked here.
const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) throw new ApiError(401, "Unauthorized request");

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET,
    );

    const user = await User.findById(decodedToken._id).select("+refreshToken");
    if (!user) throw new ApiError(401, "Unauthorized Refresh Token");

    if (incomingRefreshToken !== user.refreshToken) {
      throw new ApiError(401, "Refresh Token is expired or invalid");
    }

    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    };

    const { accessToken, refreshToken: newRefreshToken } =
      await generateAccessAndRefreshToken(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access token refreshed",
        ),
      );
  } catch (error) {
    throw new ApiError(401, error.message || "Invalid refresh token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select("+password");
  const isPasswordMatch = await user.isCorrectPassword(oldPassword);

  if (!isPasswordMatch) throw new ApiError(401, "Invalid old password");

  user.password = newPassword;
  await user.save({ validateBeforeSave: false }); // pre-save hook still hashes it

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));
});

// ============================================================
// FORGOT PASSWORD (public)
// POST /api/v1/users/forgot-password
// ============================================================
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email?.trim()) {
    throw new ApiError(400, "Email is required");
  }

  const normalizedEmail = email.toLowerCase().trim();
  const genericMessage =
    "If an account exists for that email, a password reset link has been sent.";

  const user = await User.findOne({ email: normalizedEmail });

  // Always respond the same way whether or not the account exists, so this
  // endpoint can't be used to enumerate registered emails.
  if (!user) {
    return res.status(200).json(new ApiResponse(200, {}, genericMessage));
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  user.passwordResetToken = tokenHash;
  user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await user.save({ validateBeforeSave: false });

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5174";
  const resetUrl = `${frontendUrl}/reset-password/${rawToken}`;

  try {
    await sendPasswordResetEmail({
      to: user.email,
      firstName: user.firstName,
      resetUrl,
    });
  } catch (emailError) {
    // Don't leave a dangling reset token if the email never went out
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });
    console.error("Failed to send password reset email:", emailError.message);
    throw new ApiError(500, "Failed to send password reset email. Please try again.");
  }

  return res.status(200).json(new ApiResponse(200, {}, genericMessage));
});

// ============================================================
// RESET PASSWORD (public)
// POST /api/v1/users/reset-password/:token
// ============================================================
const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  if (!token) {
    throw new ApiError(400, "Reset token is required");
  }
  if (!password || password.length < 8) {
    throw new ApiError(400, "Password must be at least 8 characters long");
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const user = await User.findOne({
    passwordResetToken: tokenHash,
    passwordResetExpires: { $gt: new Date() },
  }).select("+passwordResetToken +passwordResetExpires");

  if (!user) {
    throw new ApiError(400, "This password reset link is invalid or has expired");
  }

  user.password = password; // pre-save hook hashes it
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  // A password reset invalidates any existing session
  user.refreshToken = undefined;
  await user.save();

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password reset successfully. Please sign in."));
});

// ============================================================
// UPDATE NOTIFICATION PREFERENCES (self-service)
// PATCH /api/v1/users/notification-preferences
// ============================================================
const updateNotificationPreferences = asyncHandler(async (req, res) => {
  const { messages } = req.body;

  if (messages === undefined) {
    throw new ApiError(400, "No notification preference provided");
  }
  if (typeof messages !== "boolean") {
    throw new ApiError(400, "messages must be true or false");
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: { "notificationPreferences.messages": messages } },
    { new: true }
  ).select("-password -refreshToken");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Notification preferences updated"));
});

const getAllUsers = asyncHandler(async (req, res) => {
  // pagination via query params: /users?page=2&limit=10
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // optional filters: /users?department=Tax%20Preparer&search=faizan
  const filter = {};
  if (req.query.department) filter.department = req.query.department;
  if (req.query.search) {
    filter.$or = [
      { firstName: { $regex: req.query.search, $options: "i" } },
      { lastName: { $regex: req.query.search, $options: "i" } },
      { email: { $regex: req.query.search, $options: "i" } },
    ];
  }

  const [users, totalUsers] = await Promise.all([
    User.find(filter)
      .select("-password -refreshToken")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    User.countDocuments(filter),
  ]);
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        users,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalUsers / limit),
          totalUsers,
          limit,
        },
      },
      "Users fetched successfully",
    ),
  );
});

const getCurrentUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select(
    "-password -refreshToken",
  );
  return res.status(200).json(new ApiResponse(200, user, "User found"));
});

// ============================================================
// GET USER BY ID (self, or admin/super-admin viewing any employee)
// GET /api/v1/users/:userId
// ============================================================
const getUserById = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const isSelf = req.user._id.toString() === userId;
  const isAdmin = ["admin", "super-admin"].includes(req.user.role);
  if (!isSelf && !isAdmin) {
    throw new ApiError(403, "You are not authorized to view this profile");
  }

  const user = await User.findById(userId).select("-password -refreshToken");
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return res.status(200).json(new ApiResponse(200, user, "User fetched successfully"));
});

const adminUpdateUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    throw new ApiError(400, "User ID is required");
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Fields an admin is allowed to update
  const allowedFields = [
    "firstName",
    "lastName",
    "email",
    "phone",
    "department",
    "experience",
    "status",
    "role",
    "userImage",
  ];

  const updates = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, "No valid fields to update");
  }

  // Check email uniqueness if email is being changed
  if (updates.email) {
    const email = updates.email.toLowerCase().trim();
    const existingUser = await User.findOne({
      email,
      _id: { $ne: userId },
    });
    if (existingUser) {
      throw new ApiError(409, "Another user is already using this email");
    }
    updates.email = email;
  }

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $set: updates },
    { new: true, runValidators: true },
  ).select("-password -refreshToken");

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedUser, "User updated successfully"),
    );
});

// ============================================================
// DELETE USER (Admin/Super Admin only)
// DELETE /api/v1/users/:userId
// ============================================================
const deleteUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    throw new ApiError(400, "User ID is required");
  }

  if (userId === req.user._id.toString()) {
    throw new ApiError(400, "You cannot delete your own account");
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Only super-admins can delete other admins/super-admins
  if (
    ["admin", "super-admin"].includes(user.role) &&
    req.user.role !== "super-admin"
  ) {
    throw new ApiError(403, "Only a super admin can delete an admin account");
  }

  await User.findByIdAndDelete(userId);

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Employee deleted successfully"));
});

const profileImageUpdate = asyncHandler(async (req, res) => {
  const userImageLocalPath = req.files?.userImage?.[0]?.path;
  if (!userImageLocalPath) throw new ApiError(400, "User image is required");

  // grab the OLD image url before we overwrite it, so we can delete it after
  const existingUser = await User.findById(req.user._id).select("userImage");
  const oldImageUrl = existingUser?.userImage;

  const profileImage = await uploadOnCloudinary(userImageLocalPath);
  if (!profileImage?.url) {
    throw new ApiError(400, "Error while uploading user image");
  }

  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    { $set: { userImage: profileImage.url } },
    { new: true },
  ).select("-password -refreshToken");

  // only delete the old one AFTER the new upload + DB update succeeded —
  // never delete first, in case something above fails and you'd lose both
  if (oldImageUrl) {
    await deleteFromCloudinary(oldImageUrl);
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedUser, "Profile image updated successfully"),
    );
});

// ============================================================
// ADMIN: SET AN EMPLOYEE'S PROFILE IMAGE (Admin/Super Admin only)
// PATCH /api/v1/users/admin/:userId/profile-image
// ============================================================
const adminUpdateUserImage = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const userImageLocalPath = req.files?.userImage?.[0]?.path;
  if (!userImageLocalPath) throw new ApiError(400, "User image is required");

  const existingUser = await User.findById(userId).select("userImage");
  if (!existingUser) {
    throw new ApiError(404, "User not found");
  }
  const oldImageUrl = existingUser.userImage;

  const profileImage = await uploadOnCloudinary(userImageLocalPath);
  if (!profileImage?.url) {
    throw new ApiError(400, "Error while uploading user image");
  }

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $set: { userImage: profileImage.url } },
    { new: true },
  ).select("-password -refreshToken");

  if (oldImageUrl) {
    await deleteFromCloudinary(oldImageUrl);
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedUser, "Employee image updated successfully"),
    );
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  forgotPassword,
  resetPassword,
  updateNotificationPreferences,
  getCurrentUser,
  getUserById,
  getAllUsers,
  adminUpdateUser,
  deleteUser,
  profileImageUpdate,
  adminUpdateUserImage,
};

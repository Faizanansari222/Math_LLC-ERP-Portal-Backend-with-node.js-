import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  uploadOnCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.models.js";
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
  console.log(email,password)

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

const updateAccountHandler = asyncHandler(async (req, res) => {
  const { firstName, lastName, email } = req.body;

  if ([firstName, lastName, email].some((field) => field?.trim() === "")) {
    throw new ApiError(400, "All fields are required");
  }

  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    { $set: { firstName, lastName, email } },
    { new: true, runValidators: true },
  ).select("-password -refreshToken");

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedUser, "Account details updated successfully"),
    );
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

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  getAllUsers,
  updateAccountHandler,
  profileImageUpdate,
};

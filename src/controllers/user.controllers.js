import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import { User } from "../models/user.models.js";

const userAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();

    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({
      validateBeforeSave: false,
    });
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(500, error.message);
  }
};

const registerUser = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, password, designation } = req.body;

  if (
    [firstName, lastName, email, password, designation].some(
      (field) => field?.trim() === "",
    )
  ) {
    throw new ApiError(400, "All fields are required");
  }

  const existingUser = await User.findOne({
    $or: [{ email }],
  });

  if (existingUser) {
    throw new ApiError(409, "User already exists");
  }

  const userImageLocalPath = req.files.userImage[0]?.path;

  if (!userImageLocalPath) throw new ApiError(400, "User image is required");

  const profileImage = await uploadOnCloudinary(userImageLocalPath);

  const user = await User.create({
    firstName,
    lastName,
    email,
    password,
    designation,
    userImage: profileImage?.url,
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken",
  );

  if (!createdUser)
    throw new ApiError(500, "something want wrong when user created");

  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User created successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if ([email, password].some((field) => field?.trim() === "")) {
    throw new ApiError(400, "All fields are required");
  }

  const user = await User.findOne({
    email,
  });

  if (!user) throw new ApiError(404, "User not found");

  const isPasswordMatch = await user.isCorrectPassword(password);

  if (!isPasswordMatch) throw new ApiError(401, "Invalid credentials");

  const { accessToken, refreshToken } = await userAccessAndRefreshToken(
    user._id,
  );
  console.log(accessToken);
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken",
  );
  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged in successfully",
      ),
    );
});

// const logoutUser = asyncHandler(async (req, res) => {
//   const options = {
//     httpOnly: true,
//     secure: true,
//   };
//   res
//     .status(200)
//     .cookie("accessToken", "", options)
//     .cookie("refreshToken", "", options)
//     .json(new ApiResponse(200, null, "User logged out successfully"));
// });

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: null,
      },
    },
    {
      new: true,
    },
  );

  const options = {
    httpOnly: true,
    secure: true,
  };
  res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, null, "User logged out successfully"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const inComingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;
  if (!inComingRefreshToken) throw new ApiError(401, "Unauthorized request");
  try {
    const decodedToken = jwt.verify(
      inComingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET,
    );

    const user = await User.findById(decodedToken._id);

    if (!user) throw new ApiError(401, "Unauthorized Refresh Token");

    if (inComingRefreshToken !== user.refreshToken)
      throw new ApiError(401, "Refresh Token is Expired or Invalid");

    const options = {
      httpOnly: true,
      secure: true,
    };
    const { accessToken, refreshToken } = await userAccessAndRefreshToken(
      user._id,
    );
    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshtoken },
          "Access token refreshed",
        ),
      );
  } catch (error) {
    throw new ApiError(500, error.message || "invalid refresh token");
  }
});
const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id);
  const isPasswordMatch = await user.isCorrectPassword(oldPassword);

  if (!isPasswordMatch) throw new ApiError(401, "invalid Old Password");
  user.password = newPassword;
  await user.save({ validateBeforeSave: false });
  return res
    .status(200)
    .json(new ApiResponse(200, null, "Password changed successfully"));
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

  User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        firstName,
        lastName,
        email,
      },
    },
    {
      new: true,
    },
  ).select("-password -refreshToken");
  return res
    .status(200)
    .json(new ApiResponse(200, null, "Account Detail update Successfully"));
});

const profileImageUpdate = asyncHandler(async (req, res) => {
  const userImageLocalPath = req.files?.userImage?.[0]?.path;
  if (!userImageLocalPath) throw new ApiError(400, "User image is required");

  const existingUser = await User.findById(req.user._id).select("userImage");
  const oldImageUrl = existingUser?.userImage;

  const profileImage = await uploadOnCloudinary(userImageLocalPath);
  if (!profileImage?.url)
    throw new ApiError(400, "Error while uploading user image");

  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    { $set: { userImage: profileImage.url } },
    { new: true },
  ).select("-password -refreshToken");

  if (oldImageUrl) await deleteFromCloudinary(oldImageUrl);

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
  updateAccountHandler,
  profileImageUpdate,
};

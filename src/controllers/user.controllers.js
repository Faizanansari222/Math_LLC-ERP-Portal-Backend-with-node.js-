import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
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

  const isPasswordMatch = await user.comparePassword(password);

  if (!isPasswordMatch) throw new ApiError(401, "Invalid credentials");

  const { accessToken, refreshToken } = await userAccessAndRefreshToken(
    user._id,
  );

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

export { registerUser, loginUser, logoutUser };

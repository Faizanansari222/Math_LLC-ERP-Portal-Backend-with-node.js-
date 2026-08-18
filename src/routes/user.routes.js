import { Router } from "express";
import {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  getAllUsers,
  updateAccountHandler,
  profileImageUpdate,
} from "../controllers/user.controllers.js";
import { verifyJWT } from "../middleware/auth.middleware.js";

const router = Router();


router.route("/register").post(registerUser);

router.route("/login").post(loginUser);

router.route("/refresh-token").post(refreshAccessToken);


router.route("/logout").post(verifyJWT, logoutUser);

router.route("/getAllUsers").get(verifyJWT, getAllUsers);

router.route("/current-user").get(verifyJWT, getCurrentUser);

router.route("/change-password").post(verifyJWT, changeCurrentPassword);

router.route("/update-account").patch(verifyJWT, updateAccountHandler);

router.route("/profile-image").patch(verifyJWT, profileImageUpdate);

export default router;
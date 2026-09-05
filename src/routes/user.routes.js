import { Router } from "express";
import {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  getAllUsers,
  adminUpdateUser,
  profileImageUpdate,
} from "../controllers/user.controllers.js";
import { verifyJWT, authorize } from "../middleware/auth.middleware.js";

const router = Router();


router
  .route("/register")
  .post(verifyJWT, authorize("super-admin", "admin"), registerUser);

router.route("/login").post(loginUser);

router.route("/refresh-token").post(refreshAccessToken);


router.route("/logout").post(verifyJWT, logoutUser);

router.route("/getAllUsers").get(verifyJWT, getAllUsers);

router.route("/current-user").get(verifyJWT, getCurrentUser);

router.route("/change-password").post(verifyJWT, changeCurrentPassword);

router.route("/admin/update-user/:userId").patch(verifyJWT, authorize("super-admin", "admin"), adminUpdateUser);

router.route("/profile-image").patch(verifyJWT, profileImageUpdate);

export default router;
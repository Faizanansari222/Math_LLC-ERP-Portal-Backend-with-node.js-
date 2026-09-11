import { Router } from "express";
import {
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
} from "../controllers/user.controllers.js";
import { verifyJWT, authorize } from "../middleware/auth.middleware.js";
import { upload } from "../middleware/multer.middleware.js";

const router = Router();


router.route("/register").post(registerUser);

router.route("/login").post(loginUser);

router.route("/refresh-token").post(refreshAccessToken);

router.route("/forgot-password").post(forgotPassword);

router.route("/reset-password/:token").post(resetPassword);

router.route("/logout").post(verifyJWT, logoutUser);

router.route("/getAllUsers").get(verifyJWT, getAllUsers);

router.route("/current-user").get(verifyJWT, getCurrentUser);

router.route("/change-password").post(verifyJWT, changeCurrentPassword);

router.route("/notification-preferences").patch(verifyJWT, updateNotificationPreferences);

router.route("/admin/update-user/:userId").patch(verifyJWT, authorize("super-admin", "admin"), adminUpdateUser);

router.route("/profile-image").patch(
  verifyJWT,
  upload.fields([{ name: "userImage", maxCount: 1 }]),
  profileImageUpdate,
);

router.route("/admin/:userId/profile-image").patch(
  verifyJWT,
  authorize("super-admin", "admin"),
  upload.fields([{ name: "userImage", maxCount: 1 }]),
  adminUpdateUserImage,
);

router
  .route("/:userId")
  .get(verifyJWT, getUserById)
  .delete(verifyJWT, authorize("super-admin", "admin"), deleteUser);

export default router;
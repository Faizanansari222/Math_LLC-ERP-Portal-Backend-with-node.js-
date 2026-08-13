import { Router } from "express";
import {
  loginUser,
  logoutUser,
  refreshAccessToken,
  registerUser,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountHandler,
  profileImageUpdate,
  getAllUsers,
} from "../controllers/user.controllers.js";
import { upload } from "../middleware/multer.middleware.js";
import { verifyJWT, authorize } from "../middleware/auth.middleware.js";

const router = Router();

// --- Public routes (no token required) ---
router
  .route("/register")
  .post(upload.fields([{ name: "userImage", maxCount: 1 }]), registerUser);

router.route("/login").post(loginUser);

// IMPORTANT: no verifyJWT here — the access token is expected to already be
// expired when this is called. Only the refresh token cookie is checked.
router.route("/refresh-token").post(refreshAccessToken);

// --- Protected routes (require a valid access token) ---
router.route("/logout").post(verifyJWT, logoutUser);
router.route("/").get(verifyJWT, authorize("admin", "super-admin"), getAllUsers);
router.route("/change-password").post(verifyJWT, changeCurrentPassword);
router.route("/current-user").get(verifyJWT, getCurrentUser);
router.route("/update-account").patch(verifyJWT, updateAccountHandler);
router
  .route("/update-avatar")
  .patch(
    verifyJWT,
    upload.fields([{ name: "userImage", maxCount: 1 }]),
    profileImageUpdate,
  );

export default router;

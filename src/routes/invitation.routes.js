import { Router } from "express";
import {
  inviteClient,
  inviteStaff,
  getAllInvitations,
  getInvitation,
  acceptInvitation,
  resendInvitation,
  revokeInvitation,
} from "../controllers/invitation.controllers.js";
import { verifyJWT, authorize } from "../middleware/auth.middleware.js";

const router = Router();

router
  .route("/")
  .get(verifyJWT, authorize("super-admin", "admin"), getAllInvitations);

router
  .route("/client")
  .post(verifyJWT, authorize("super-admin", "admin"), inviteClient);

router
  .route("/staff")
  .post(verifyJWT, authorize("super-admin", "admin"), inviteStaff);

router
  .route("/:id/resend")
  .post(verifyJWT, authorize("super-admin", "admin"), resendInvitation);

router.route("/:token").get(getInvitation);

router.route("/:token/accept").post(acceptInvitation);

router
  .route("/:id")
  .delete(verifyJWT, authorize("super-admin", "admin"), revokeInvitation);

export default router;

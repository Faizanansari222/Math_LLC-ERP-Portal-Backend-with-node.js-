import { Router } from "express";

import {
  createReference,
  getAllReferences,
  getReferenceById,
  updateReference,
  deleteReference,
} from "../controllers/reference.controllers.js";

import { verifyJWT, authorize } from "../middleware/auth.middleware.js";

const router = Router();

// All reference routes require authentication
router.use(verifyJWT);

const staffOnly = authorize("super-admin", "admin", "user");
const adminOnly = authorize("super-admin", "admin");

// Staff (including onboarding form) can read the list to populate the
// "Referred By" dropdown; only admins can manage the list itself.
router.get("/", staffOnly, getAllReferences);
router.post("/", adminOnly, createReference);
router.get("/:referenceId", staffOnly, getReferenceById);
router.patch("/:referenceId", adminOnly, updateReference);
router.delete("/:referenceId", adminOnly, deleteReference);

export default router;

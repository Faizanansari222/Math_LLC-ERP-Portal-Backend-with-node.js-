import { Router } from "express";

import {
  createClient,
  getAllClients,
  getClientById,
  getMyClientProfile,
  updateClient,
  deleteClient,
  assignClient,
  unassignClient,
  updateClientStatus,
  updateTaxFilingStatus,
  getClientStatistics,
  sendEmailToClient,
  sendWelcomeEmailToClient,
  sendTaxUpdateEmail,
} from "../controllers/client.controllers.js";

import { verifyJWT, authorize } from "../middleware/auth.middleware.js";

const router = Router();

// All client routes require authentication
router.use(verifyJWT);

// Client-portal users only ever see their own linked profile via /me —
// everything else below is CRM/staff tooling and must not be reachable
// by a "client" role login.
const staffOnly = authorize("super-admin", "admin", "user");
const adminOnly = authorize("super-admin", "admin");

// Statistics and "me" MUST come before /:clientId
router.get("/statistics", staffOnly, getClientStatistics);
router.get("/me", authorize("client"), getMyClientProfile);

// CRUD
router.post("/", adminOnly, createClient);
router.get("/", staffOnly, getAllClients);
router.get("/:clientId", staffOnly, getClientById);
router.patch("/:clientId", adminOnly, updateClient);
router.delete("/:clientId", adminOnly, deleteClient);

// Assignment
router.patch("/:clientId/assign", adminOnly, assignClient);
router.patch("/:clientId/unassign", adminOnly, unassignClient);

// Status
router.patch("/:clientId/status", adminOnly, updateClientStatus);
router.patch("/:clientId/tax-status", adminOnly, updateTaxFilingStatus);

// Email
router.post("/:clientId/send-email", adminOnly, sendEmailToClient);
router.post("/:clientId/send-welcome", adminOnly, sendWelcomeEmailToClient);
router.post("/:clientId/send-tax-update", adminOnly, sendTaxUpdateEmail);

export default router;
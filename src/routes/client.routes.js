import { Router } from "express";

import {
  createClient,
  getAllClients,
  getClientById,
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

// All client CRM routes require authentication, staff only (clients don't manage the CRM)
router.use(verifyJWT, authorize("super-admin", "admin", "user"));

// Statistics MUST come before /:clientId
router.get("/statistics", getClientStatistics);

// CRUD
router.post("/", createClient);
router.get("/", getAllClients);
router.get("/:clientId", getClientById);
router.patch("/:clientId", updateClient);
router.delete("/:clientId", deleteClient);

// Assignment
router.patch("/:clientId/assign", assignClient);
router.patch("/:clientId/unassign", unassignClient);

// Status
router.patch("/:clientId/status", updateClientStatus);
router.patch("/:clientId/tax-status", updateTaxFilingStatus);

// Email
router.post("/:clientId/send-email", sendEmailToClient);
router.post("/:clientId/send-welcome", sendWelcomeEmailToClient);
router.post("/:clientId/send-tax-update", sendTaxUpdateEmail);

export default router;
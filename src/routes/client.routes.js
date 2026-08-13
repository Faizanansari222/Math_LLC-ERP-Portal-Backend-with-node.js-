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
} from "../controllers/client.controllers.js";

import { verifyJWT } from "../middleware/auth.middleware.js";

const router = Router();

// All client routes require authentication
router.use(verifyJWT);

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

export default router;
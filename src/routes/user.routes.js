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

router.route("/").post(verifyJWT, createClient).get(verifyJWT, getAllClients);

router.route("/statistics").get(verifyJWT, getClientStatistics);

router
  .route("/:clientId")
  .get(verifyJWT, getClientById)
  .patch(verifyJWT, updateClient)
  .delete(verifyJWT, deleteClient);

router.route("/:clientId/assign").patch(verifyJWT, assignClient);

router.route("/:clientId/unassign").patch(verifyJWT, unassignClient);

router.route("/:clientId/status").patch(verifyJWT, updateClientStatus);

router.route("/:clientId/tax-status").patch(verifyJWT, updateTaxFilingStatus);

export default router;

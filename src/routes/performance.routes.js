import { Router } from "express";
import {
  calculatePerformance,
  getEmployeePerformance,
  getAllPerformanceSummary,
  getDepartmentPerformance,
} from "../controllers/performance.controllers.js";
import { verifyJWT } from "../middleware/auth.middleware.js";

const router = Router();

// All routes require authentication
router.use(verifyJWT);

// GET /api/v1/performance - all employees summary (admin only)
router.get("/", getAllPerformanceSummary);

// GET /api/v1/performance/department/:department - department performance (admin only)
router.get("/department/:department", getDepartmentPerformance);

// POST /api/v1/performance/calculate/:employeeId - calculate performance
router.post("/calculate/:employeeId", calculatePerformance);

// GET /api/v1/performance/:employeeId - get employee performance
router.get("/:employeeId", getEmployeePerformance);

export default router;

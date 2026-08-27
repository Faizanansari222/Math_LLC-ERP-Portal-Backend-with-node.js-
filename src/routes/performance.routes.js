import { Router } from "express";
import {
  calculatePerformance,
  getEmployeePerformance,
  getAllPerformanceSummary,
  getDepartmentPerformance,
  clockIn,
  clockOut,
  getMyTimesheets,
  getAllTimesheets,
  getTimesheetsByEmployee,
} from "../controllers/performance.controllers.js";
import { verifyJWT } from "../middleware/auth.middleware.js";

const router = Router();

// All routes require authentication
router.use(verifyJWT);

// ========== Timesheet Routes ==========
// GET /api/v1/performance/my-timesheets - get current user's timesheets
router.get("/my-timesheets", getMyTimesheets);

// POST /api/v1/performance/timesheets/clock-in - clock in
router.post("/timesheets/clock-in", clockIn);

// GET /api/v1/performance/timesheets - get all timesheets (admin only)
router.get("/timesheets", getAllTimesheets);

// GET /api/v1/performance/timesheets/employee/:employeeId - get timesheets by employee
router.get("/timesheets/employee/:employeeId", getTimesheetsByEmployee);

// PATCH /api/v1/performance/timesheets/:timesheetId/clock-out - clock out
router.patch("/timesheets/:timesheetId/clock-out", clockOut);

// ========== Performance Routes ==========
// GET /api/v1/performance - all employees summary (admin only)
router.get("/", getAllPerformanceSummary);

// GET /api/v1/performance/department/:department - department performance (admin only)
router.get("/department/:department", getDepartmentPerformance);

// POST /api/v1/performance/calculate/:employeeId - calculate performance
router.post("/calculate/:employeeId", calculatePerformance);

// GET /api/v1/performance/:employeeId - get employee performance
router.get("/:employeeId", getEmployeePerformance);

export default router;

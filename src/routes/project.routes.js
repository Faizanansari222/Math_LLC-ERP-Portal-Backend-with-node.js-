import { Router } from "express";
import {
  assignProject,
  getAllProjects,
  getProjectById,
  updateProject,
  deleteProject,
  getEmployeeProjects,
  getEmployeeDashboard,
  startProject,
  submitProject,
  approveProject,
  requestProjectChanges,
} from "../controllers/project.controllers.js";
import { verifyJWT, authorize } from "../middleware/auth.middleware.js";

const router = Router();

// All routes require authentication
router.use(verifyJWT);

// Internal staff tooling — clients have no business here, they only ever
// see their own projects via GET / (auto-scoped) and GET /:projectId.
const staffOnly = authorize("super-admin", "admin", "user");

// Employee dashboard (must come before /:projectId)
router.get("/dashboard/:employeeId", staffOnly, getEmployeeDashboard);

// Employee projects (must come before /:projectId)
router.get("/employee/:employeeId", staffOnly, getEmployeeProjects);

// CRUD
router.post("/", staffOnly, assignProject);
router.get("/", getAllProjects);
router.get("/:projectId", getProjectById);
router.patch("/:projectId", staffOnly, updateProject);
router.delete("/:projectId", staffOnly, deleteProject);

// Task status workflow (assigned employee / admin only)
router.patch("/:projectId/start", staffOnly, startProject);
router.patch("/:projectId/submit", staffOnly, submitProject);
router.patch("/:projectId/approve", staffOnly, approveProject);
router.patch("/:projectId/request-changes", staffOnly, requestProjectChanges);

export default router;

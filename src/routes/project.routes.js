import { Router } from "express";
import {
  assignProject,
  getAllProjects,
  getProjectById,
  updateProject,
  deleteProject,
  getEmployeeProjects,
  getEmployeeDashboard,
} from "../controllers/project.controllers.js";
import { verifyJWT, authorize } from "../middleware/auth.middleware.js";

const router = Router();

// All routes require authentication, staff only (clients have no project access)
router.use(verifyJWT, authorize("super-admin", "admin", "user"));

// Employee dashboard (must come before /:projectId)
router.get("/dashboard/:employeeId", getEmployeeDashboard);

// Employee projects (must come before /:projectId)
router.get("/employee/:employeeId", getEmployeeProjects);

// CRUD
router.post("/", assignProject);
router.get("/", getAllProjects);
router.get("/:projectId", getProjectById);
router.patch("/:projectId", updateProject);
router.delete("/:projectId", deleteProject);

export default router;

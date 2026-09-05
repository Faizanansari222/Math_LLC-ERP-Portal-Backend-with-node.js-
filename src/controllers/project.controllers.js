import { Project } from "../models/project.models.js";
import { Client } from "../models/client.models.js";
import { User } from "../models/user.models.js";
import { Task } from "../models/task.models.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";

// ============================================================
// ASSIGN PROJECT (Admin only)
// POST /api/v1/projects
// ============================================================
const assignProject = asyncHandler(async (req, res) => {
  const { title, description, client, assignedTo, serviceType, priority, deadline, notes } = req.body;

  if (!title?.trim()) throw new ApiError(400, "Project title is required");
  if (!client) throw new ApiError(400, "Client ID is required");
  if (!assignedTo) throw new ApiError(400, "Employee ID is required");
  if (!serviceType) throw new ApiError(400, "Service type is required");
  if (!deadline) throw new ApiError(400, "Deadline is required");

  // Validate client exists
  const clientDoc = await Client.findById(client);
  if (!clientDoc) throw new ApiError(404, "Client not found");

  // Validate employee exists
  const employee = await User.findById(assignedTo);
  if (!employee) throw new ApiError(404, "Employee not found");

  // Verify the person assigning is admin or super-admin
  if (!["admin", "super-admin"].includes(req.user.role)) {
    throw new ApiError(403, "Only admins can assign projects");
  }

  const project = await Project.create({
    title: title.trim(),
    description: description?.trim(),
    client,
    assignedTo,
    assignedBy: req.user._id,
    serviceType,
    priority: priority || "medium",
    deadline,
    notes: notes?.trim(),
  });

  const createdProject = await Project.findById(project._id)
    .populate("client", "firstName lastName businessName email")
    .populate("assignedTo", "firstName lastName email department")
    .populate("assignedBy", "firstName lastName email");

  if (!createdProject) {
    throw new ApiError(500, "Something went wrong while creating the project");
  }

  return res
    .status(201)
    .json(new ApiResponse(201, createdProject, "Project assigned successfully"));
});

// ============================================================
// GET ALL PROJECTS
// GET /api/v1/projects
// ============================================================
const getAllProjects = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);
  const skip = (page - 1) * limit;

  const { status, priority, assignedTo, client, serviceType, search } = req.query;

  const filter = {};

  // If employee, only show their projects
  if (req.user.role === "user") {
    filter.assignedTo = req.user._id;
  }

  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (assignedTo) filter.assignedTo = assignedTo;
  if (client) filter.client = client;
  if (serviceType) filter.serviceType = serviceType;

  if (search?.trim()) {
    const searchTerm = search.trim();
    filter.$or = [
      { title: { $regex: searchTerm, $options: "i" } },
      { description: { $regex: searchTerm, $options: "i" } },
      { notes: { $regex: searchTerm, $options: "i" } },
    ];
  }

  const [projects, totalProjects] = await Promise.all([
    Project.find(filter)
      .populate("client", "firstName lastName businessName email")
      .populate("assignedTo", "firstName lastName email department")
      .populate("assignedBy", "firstName lastName email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Project.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(totalProjects / limit);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        projects,
        pagination: {
          currentPage: page,
          totalPages,
          totalProjects,
          limit,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      },
      "Projects fetched successfully"
    )
  );
});

// ============================================================
// GET PROJECT BY ID
// GET /api/v1/projects/:projectId
// ============================================================
const getProjectById = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  const project = await Project.findById(projectId)
    .populate("client", "firstName lastName businessName email phone services")
    .populate("assignedTo", "firstName lastName email department")
    .populate("assignedBy", "firstName lastName email");

  if (!project) throw new ApiError(404, "Project not found");

  // Employees can only see their own projects
  if (req.user.role === "user" && project.assignedTo._id.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You can only view your own projects");
  }

  // Get related tasks for this project
  const tasks = await Task.find({ assignedTo: project.assignedTo._id })
    .sort({ createdAt: -1 })
    .limit(5);

  return res.status(200).json(
    new ApiResponse(
      200,
      { project, recentTasks: tasks },
      "Project fetched successfully"
    )
  );
});

// ============================================================
// UPDATE PROJECT
// PATCH /api/v1/projects/:projectId
// ============================================================
const updateProject = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  if (!req.body || Object.keys(req.body).length === 0) {
    throw new ApiError(400, "Update data is required");
  }

  const existingProject = await Project.findById(projectId);
  if (!existingProject) throw new ApiError(404, "Project not found");

  // Employees can only update status/progress/notes on their own projects
  if (req.user.role === "user") {
    if (existingProject.assignedTo.toString() !== req.user._id.toString()) {
      throw new ApiError(403, "You can only update your own projects");
    }
    // Employees can only change status, progress, and notes
    const allowedFields = ["status", "progress", "notes"];
    const restrictedUpdate = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        restrictedUpdate[field] = req.body[field];
      }
    }
    req.body = restrictedUpdate;
  }

  // Prevent changing these fields
  delete req.body._id;
  delete req.body.createdAt;
  delete req.body.updatedAt;
  delete req.body.assignedBy;

  const updatedProject = await Project.findByIdAndUpdate(
    projectId,
    { $set: req.body },
    { new: true, runValidators: true }
  )
    .populate("client", "firstName lastName businessName email")
    .populate("assignedTo", "firstName lastName email department")
    .populate("assignedBy", "firstName lastName email");

  if (!updatedProject) throw new ApiError(404, "Project not found");

  return res
    .status(200)
    .json(new ApiResponse(200, updatedProject, "Project updated successfully"));
});

// ============================================================
// DELETE PROJECT (Admin only)
// DELETE /api/v1/projects/:projectId
// ============================================================
const deleteProject = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  if (!["admin", "super-admin"].includes(req.user.role)) {
    throw new ApiError(403, "Only admins can delete projects");
  }

  const project = await Project.findByIdAndDelete(projectId);
  if (!project) throw new ApiError(404, "Project not found");

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Project deleted successfully"));
});

// ============================================================
// GET EMPLOYEE'S PROJECTS
// GET /api/v1/projects/employee/:employeeId
// ============================================================
const getEmployeeProjects = asyncHandler(async (req, res) => {
  const { employeeId } = req.params;

  const employee = await User.findById(employeeId).select("-password -refreshToken");
  if (!employee) throw new ApiError(404, "Employee not found");

  // Employees can only see their own projects
  if (req.user.role === "user" && req.user._id.toString() !== employeeId) {
    throw new ApiError(403, "You can only view your own projects");
  }

  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);
  const skip = (page - 1) * limit;

  const { status } = req.query;
  const filter = { assignedTo: employeeId };
  if (status) filter.status = status;

  const [projects, totalProjects] = await Promise.all([
    Project.find(filter)
      .populate("client", "firstName lastName businessName email")
      .populate("assignedBy", "firstName lastName email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Project.countDocuments(filter),
  ]);

  // Get project stats for this employee
  const stats = await Project.aggregate([
    { $match: { assignedTo: employee._id } },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);

  const projectStats = {
    total: totalProjects,
    pending: 0,
    "in-progress": 0,
    completed: 0,
    "on-hold": 0,
    cancelled: 0,
  };

  stats.forEach((s) => {
    projectStats[s._id] = s.count;
  });

  const totalPages = Math.ceil(totalProjects / limit);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        employee,
        projects,
        stats: projectStats,
        pagination: {
          currentPage: page,
          totalPages,
          totalProjects,
          limit,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      },
      "Employee projects fetched successfully"
    )
  );
});

// ============================================================
// EMPLOYEE DASHBOARD
// GET /api/v1/projects/dashboard/:employeeId
// ============================================================
const getEmployeeDashboard = asyncHandler(async (req, res) => {
  const { employeeId } = req.params;

  // Employees can only see their own dashboard
  if (req.user.role === "user" && req.user._id.toString() !== employeeId) {
    throw new ApiError(403, "You can only view your own dashboard");
  }

  const employee = await User.findById(employeeId).select("-password -refreshToken");
  if (!employee) throw new ApiError(404, "Employee not found");

  // Get assigned clients
  const assignedClients = await Client.find({ assignedTo: employeeId })
    .select("firstName lastName businessName email phone status services taxFilingStatus")
    .sort({ createdAt: -1 });

  // Get all tasks for this employee
  const tasks = await Task.find({ assignedTo: employeeId })
    .sort({ createdAt: -1 });

  // Get all projects for this employee
  const projects = await Project.find({ assignedTo: employeeId })
    .populate("client", "firstName lastName businessName email")
    .sort({ createdAt: -1 });

  // Task statistics
  const taskStats = {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === "pending").length,
    "in-progress": tasks.filter((t) => t.status === "in-progress").length,
    completed: tasks.filter((t) => t.status === "completed").length,
  };

  // Project statistics
  const projectStats = {
    total: projects.length,
    pending: projects.filter((p) => p.status === "pending").length,
    "in-progress": projects.filter((p) => p.status === "in-progress").length,
    completed: projects.filter((p) => p.status === "completed").length,
    "on-hold": projects.filter((p) => p.status === "on-hold").length,
    cancelled: projects.filter((p) => p.status === "cancelled").length,
  };

  // Client statistics
  const clientStats = {
    total: assignedClients.length,
    active: assignedClients.filter((c) => c.status === "active").length,
    pending: assignedClients.filter((c) => c.status === "pending").length,
    inactive: assignedClients.filter((c) => c.status === "inactive").length,
    "on-hold": assignedClients.filter((c) => c.status === "on-hold").length,
  };

  // Upcoming deadlines (next 7 days)
  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const upcomingDeadlines = projects
    .filter((p) => {
      const deadline = new Date(p.deadline);
      return deadline >= now && deadline <= nextWeek && p.status !== "completed" && p.status !== "cancelled";
    })
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
    .slice(0, 5);

  // Recent activity (last 5 projects and tasks combined)
  const recentProjects = projects.slice(0, 5).map((p) => ({
    type: "project",
    id: p._id,
    title: p.title,
    status: p.status,
    client: p.client,
    deadline: p.deadline,
    createdAt: p.createdAt,
  }));

  const recentTasks = tasks.slice(0, 5).map((t) => ({
    type: "task",
    id: t._id,
    title: t.title,
    status: t.status,
    client: t.client,
    dueDate: t.dueDate,
    createdAt: t.createdAt,
  }));

  const recentActivity = [...recentProjects, ...recentTasks]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 10);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        employee,
        summary: {
          assignedClients: clientStats.total,
          totalProjects: projectStats.total,
          totalTasks: taskStats.total,
          pendingTasks: taskStats.pending,
          completedTasks: taskStats.completed,
          overdueDeadlines: projects.filter(
            (p) =>
              new Date(p.deadline) < now &&
              p.status !== "completed" &&
              p.status !== "cancelled"
          ).length,
        },
        clientStats,
        projectStats,
        taskStats,
        assignedClients,
        upcomingDeadlines,
        recentActivity,
      },
      "Employee dashboard fetched successfully"
    )
  );
});

export {
  assignProject,
  getAllProjects,
  getProjectById,
  updateProject,
  deleteProject,
  getEmployeeProjects,
  getEmployeeDashboard,
};

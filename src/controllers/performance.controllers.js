import { Performance } from "../models/performance.models.js";
import { Task } from "../models/task.models.js";
import { Project } from "../models/project.models.js";
import { User } from "../models/user.models.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";

// ============================================================
// CALCULATE EMPLOYEE PERFORMANCE
// POST /api/v1/performance/calculate/:employeeId
// ============================================================
const calculatePerformance = asyncHandler(async (req, res) => {
  const { employeeId } = req.params;
  const { startDate, endDate } = req.body;

  // Only admin/super-admin can calculate performance for others
  if (req.user.role === "user" && req.user._id.toString() !== employeeId) {
    throw new ApiError(403, "You can only view your own performance");
  }

  const employee = await User.findById(employeeId).select("-password -refreshToken");
  if (!employee) throw new ApiError(404, "Employee not found");

  const periodStart = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1));
  const periodEnd = endDate ? new Date(endDate) : new Date();

  // Get all tasks for this employee within the period
  const tasks = await Task.find({
    assignedTo: employeeId,
    createdAt: { $gte: periodStart, $lte: periodEnd },
  });

  // Get all projects for this employee within the period
  const projects = await Project.find({
    assignedTo: employeeId,
    createdAt: { $gte: periodStart, $lte: periodEnd },
  });

  // Calculate task metrics
  const totalTasksAssigned = tasks.length;
  const totalTasksCompleted = tasks.filter((t) => t.status === "completed").length;
  const totalTasksPending = tasks.filter((t) => t.status === "pending" || t.status === "in-progress").length;

  // Calculate overdue tasks
  const now = new Date();
  const totalTasksOverdue = tasks.filter(
    (t) => t.status !== "completed" && new Date(t.dueDate) < now
  ).length;

  // Calculate project metrics
  const totalProjectsAssigned = projects.length;
  const totalProjectsCompleted = projects.filter((p) => p.status === "completed").length;

  // Calculate on-time completion rate
  const completedTasks = tasks.filter((t) => t.status === "completed" && t.completedAt);
  let onTimeCount = 0;
  let totalCompletionDays = 0;

  completedTasks.forEach((task) => {
    const completionTime = new Date(task.completedAt).getTime();
    const dueTime = new Date(task.dueDate).getTime();
    const creationTime = new Date(task.createdAt).getTime();

    if (completionTime <= dueTime) {
      onTimeCount++;
    }

    const completionDays = (completionTime - creationTime) / (1000 * 60 * 60 * 24);
    totalCompletionDays += completionDays;
  });

  const onTimeCompletionRate = totalTasksCompleted > 0
    ? Math.round((onTimeCount / totalTasksCompleted) * 100)
    : 0;

  const avgCompletionTimeDays = totalTasksCompleted > 0
    ? Math.round((totalCompletionDays / totalTasksCompleted) * 100) / 100
    : 0;

  // Calculate performance score (0-100)
  // Weights: completion rate (40%), on-time rate (30%), overdue penalty (20%), project completion (10%)
  const completionRate = totalTasksAssigned > 0
    ? (totalTasksCompleted / totalTasksAssigned) * 100
    : 0;

  const overdueRate = totalTasksAssigned > 0
    ? (totalTasksOverdue / totalTasksAssigned) * 100
    : 0;

  const projectCompletionRate = totalProjectsAssigned > 0
    ? (totalProjectsCompleted / totalProjectsAssigned) * 100
    : 0;

  const performanceScore = Math.min(100, Math.max(0,
    Math.round(
      completionRate * 0.4 +
      onTimeCompletionRate * 0.3 +
      (100 - overdueRate) * 0.2 +
      projectCompletionRate * 0.1
    )
  ));

  // Determine rating
  let rating;
  if (performanceScore >= 85) rating = "excellent";
  else if (performanceScore >= 70) rating = "good";
  else if (performanceScore >= 50) rating = "average";
  else rating = "needs-improvement";

  // Save or update performance record
  const performance = await Performance.findOneAndUpdate(
    {
      employee: employeeId,
      "period.startDate": periodStart,
      "period.endDate": periodEnd,
    },
    {
      employee: employeeId,
      totalTasksAssigned,
      totalTasksCompleted,
      totalTasksPending,
      totalTasksOverdue,
      totalProjectsAssigned,
      totalProjectsCompleted,
      performanceScore,
      onTimeCompletionRate,
      avgCompletionTimeDays,
      period: { startDate: periodStart, endDate: periodEnd },
      rating,
      notes: req.body.notes || "",
    },
    { new: true, upsert: true }
  );

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        employee: {
          _id: employee._id,
          firstName: employee.firstName,
          lastName: employee.lastName,
          email: employee.email,
          department: employee.department,
        },
        performance,
      },
      "Performance calculated successfully"
    )
  );
});

// ============================================================
// GET EMPLOYEE PERFORMANCE
// GET /api/v1/performance/:employeeId
// ============================================================
const getEmployeePerformance = asyncHandler(async (req, res) => {
  const { employeeId } = req.params;

  if (req.user.role === "user" && req.user._id.toString() !== employeeId) {
    throw new ApiError(403, "You can only view your own performance");
  }

  const employee = await User.findById(employeeId).select("-password -refreshToken");
  if (!employee) throw new ApiError(404, "Employee not found");

  const performances = await Performance.find({ employee: employeeId })
    .sort({ "period.startDate": -1 })
    .limit(12);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        employee: {
          _id: employee._id,
          firstName: employee.firstName,
          lastName: employee.lastName,
          email: employee.email,
          department: employee.department,
        },
        performances,
      },
      "Employee performance fetched successfully"
    )
  );
});

// ============================================================
// GET ALL EMPLOYEES PERFORMANCE SUMMARY
// GET /api/v1/performance
// ============================================================
const getAllPerformanceSummary = asyncHandler(async (req, res) => {
  if (req.user.role === "user") {
    throw new ApiError(403, "Only admins can view all performance summaries");
  }

  // Get the latest performance record for each employee
  const summary = await Performance.aggregate([
    { $sort: { "period.startDate": -1 } },
    {
      $group: {
        _id: "$employee",
        latestPerformance: { $first: "$$ROOT" },
      },
    },
    {
      $replaceRoot: { newRoot: "$latestPerformance" },
    },
    {
      $lookup: {
        from: "users",
        localField: "employee",
        foreignField: "_id",
        as: "employeeInfo",
      },
    },
    { $unwind: "$employeeInfo" },
    {
      $project: {
        employee: 1,
        performanceScore: 1,
        onTimeCompletionRate: 1,
        avgCompletionTimeDays: 1,
        totalTasksAssigned: 1,
        totalTasksCompleted: 1,
        totalTasksOverdue: 1,
        rating: 1,
        period: 1,
        "employeeInfo.firstName": 1,
        "employeeInfo.lastName": 1,
        "employeeInfo.email": 1,
        "employeeInfo.department": 1,
      },
    },
    { $sort: { performanceScore: -1 } },
  ]);

  return res.status(200).json(
    new ApiResponse(
      200,
      summary,
      "Performance summary fetched successfully"
    )
  );
});

// ============================================================
// GET DEPARTMENT PERFORMANCE
// GET /api/v1/performance/department/:department
// ============================================================
const getDepartmentPerformance = asyncHandler(async (req, res) => {
  const { department } = req.params;

  if (req.user.role === "user") {
    throw new ApiError(403, "Only admins can view department performance");
  }

  // Get all employees in the department
  const employees = await User.find({ department }).select("-password -refreshToken");

  if (employees.length === 0) {
    throw new ApiError(404, "No employees found in this department");
  }

  const employeeIds = employees.map((e) => e._id);

  // Get latest performance for each employee in department
  const performances = await Performance.aggregate([
    { $match: { employee: { $in: employeeIds } } },
    { $sort: { "period.startDate": -1 } },
    {
      $group: {
        _id: "$employee",
        latestPerformance: { $first: "$$ROOT" },
      },
    },
    {
      $replaceRoot: { newRoot: "$latestPerformance" },
    },
    {
      $lookup: {
        from: "users",
        localField: "employee",
        foreignField: "_id",
        as: "employeeInfo",
      },
    },
    { $unwind: "$employeeInfo" },
    {
      $project: {
        employee: 1,
        performanceScore: 1,
        onTimeCompletionRate: 1,
        avgCompletionTimeDays: 1,
        totalTasksAssigned: 1,
        totalTasksCompleted: 1,
        totalTasksOverdue: 1,
        rating: 1,
        period: 1,
        "employeeInfo.firstName": 1,
        "employeeInfo.lastName": 1,
        "employeeInfo.email": 1,
      },
    },
    { $sort: { performanceScore: -1 } },
  ]);

  // Calculate department averages
  const avgScore = performances.length > 0
    ? Math.round(performances.reduce((sum, p) => sum + p.performanceScore, 0) / performances.length)
    : 0;

  const avgOnTimeRate = performances.length > 0
    ? Math.round(performances.reduce((sum, p) => sum + p.onTimeCompletionRate, 0) / performances.length)
    : 0;

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        department,
        departmentStats: {
          totalEmployees: employees.length,
          avgPerformanceScore: avgScore,
          avgOnTimeCompletionRate: avgOnTimeRate,
        },
        employees: performances,
      },
      "Department performance fetched successfully"
    )
  );
});

export {
  calculatePerformance,
  getEmployeePerformance,
  getAllPerformanceSummary,
  getDepartmentPerformance,
};

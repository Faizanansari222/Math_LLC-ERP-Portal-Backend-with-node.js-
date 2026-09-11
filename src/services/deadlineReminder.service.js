import { Project } from "../models/project.models.js";
import { createNotification } from "../controllers/notification.controllers.js";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Finds tasks whose deadline falls within the next 24 hours (and are still
 * open) and sends each assignee a one-time "deadline approaching" reminder.
 * Safe to call repeatedly — `deadlineReminderSent` prevents duplicates, and
 * it's reset automatically if the deadline is later pushed out.
 */
export const sendUpcomingDeadlineReminders = async (io) => {
  const now = new Date();
  const in24h = new Date(now.getTime() + ONE_DAY_MS);

  const dueSoonProjects = await Project.find({
    deadline: { $gt: now, $lte: in24h },
    status: { $nin: ["completed", "cancelled"] },
    deadlineReminderSent: { $ne: true },
  }).populate("assignedTo", "firstName lastName");

  for (const project of dueSoonProjects) {
    if (!project.assignedTo) continue;

    const deadlineLabel = new Date(project.deadline).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

    try {
      await createNotification({
        recipient: project.assignedTo._id,
        type: "project-deadline",
        title: "Deadline Approaching",
        message: `"${project.title}" is due tomorrow (${deadlineLabel}).`,
        entityType: "project",
        entityId: project._id,
        io,
      });

      project.deadlineReminderSent = true;
      await project.save({ validateBeforeSave: false });
    } catch (error) {
      console.error(`Failed to send deadline reminder for project ${project._id}:`, error.message);
    }
  }

  return dueSoonProjects.length;
};

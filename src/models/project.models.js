import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },

    // Which client this project is for
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
      index: true,
    },

    // Employee assigned to this project
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Admin who assigned the project
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Service type from client's services
    serviceType: {
      type: String,
      enum: [
        "tax-filing",
        "tax-planning",
        "payroll",
        "bookkeeping",
        "audit",
        "business-formation",
        "financial-reporting",
        "consulting",
        "other",
      ],
      required: true,
    },

    status: {
      type: String,
      enum: [
        "pending",
        "in-progress",
        "submitted",
        "changes-requested",
        "completed",
        "on-hold",
        "cancelled",
      ],
      default: "pending",
      index: true,
    },

    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },

    deadline: {
      type: Date,
      required: true,
    },

    completedAt: {
      type: Date,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: [1000, "Notes cannot exceed 1000 characters"],
    },

    // Progress percentage
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    // Set once a "deadline approaching" reminder notification has been sent,
    // so the reminder job doesn't notify the same task twice.
    deadlineReminderSent: {
      type: Boolean,
      default: false,
    },

    // Task workflow fields
    submissionComment: {
      type: String,
      trim: true,
      maxlength: [1000, "Submission comment cannot exceed 1000 characters"],
    },
    submittedAt: {
      type: Date,
    },
    adminComment: {
      type: String,
      trim: true,
      maxlength: [1000, "Admin comment cannot exceed 1000 characters"],
    },

    // Activity / audit trail
    activity: [
      {
        action: {
          type: String,
          required: true,
          trim: true,
        },
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        comment: {
          type: String,
          trim: true,
          maxlength: [1000, "Activity comment cannot exceed 1000 characters"],
        },
        previousStatus: {
          type: String,
        },
        newStatus: {
          type: String,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true }
);

// Compound index for the common "employee's tasks by status" query pattern
projectSchema.index({ assignedTo: 1, status: 1 });

// Used by the deadline-reminder job to efficiently find tasks due soon
projectSchema.index({ deadline: 1, status: 1 });

// Auto-set completedAt when status changes to completed
projectSchema.pre("save", function (next) {
  if (this.isModified("status") && this.status === "completed" && !this.completedAt) {
    this.completedAt = new Date();
    this.progress = 100;
  }
  // If the deadline is pushed out, allow a fresh reminder to fire for it
  if (this.isModified("deadline") && !this.isNew) {
    this.deadlineReminderSent = false;
  }
  next();
});

export const Project = mongoose.model("Project", projectSchema);

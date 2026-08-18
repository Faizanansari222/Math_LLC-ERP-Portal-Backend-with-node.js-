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
      enum: ["pending", "in-progress", "completed", "on-hold", "cancelled"],
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
  },
  { timestamps: true }
);

// Auto-set completedAt when status changes to completed
projectSchema.pre("save", function (next) {
  if (this.isModified("status") && this.status === "completed" && !this.completedAt) {
    this.completedAt = new Date();
    this.progress = 100;
  }
  next();
});

export const Project = mongoose.model("Project", projectSchema);

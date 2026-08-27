import mongoose from "mongoose";

const performanceSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Task metrics
    totalTasksAssigned: {
      type: Number,
      default: 0,
    },
    totalTasksCompleted: {
      type: Number,
      default: 0,
    },
    totalTasksPending: {
      type: Number,
      default: 0,
    },
    totalTasksOverdue: {
      type: Number,
      default: 0,
    },

    // Project metrics
    totalProjectsAssigned: {
      type: Number,
      default: 0,
    },
    totalProjectsCompleted: {
      type: Number,
      default: 0,
    },

    // Performance score (0-100)
    performanceScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    // On-time completion rate (percentage)
    onTimeCompletionRate: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    // Average completion time in days
    avgCompletionTimeDays: {
      type: Number,
      default: 0,
    },

    // Period for this performance record
    period: {
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
    },

    // Rating: excellent, good, average, needs-improvement
    rating: {
      type: String,
      enum: ["excellent", "good", "average", "needs-improvement"],
      default: "average",
    },

    // Manager notes
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, "Notes cannot exceed 1000 characters"],
    },
  },
  { timestamps: true }
);

// Compound index for efficient queries
performanceSchema.index({ employee: 1, "period.startDate": -1 });

export const Performance = mongoose.model("Performance", performanceSchema);

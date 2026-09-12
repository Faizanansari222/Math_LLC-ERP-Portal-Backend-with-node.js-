import mongoose from "mongoose";

const referenceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Reference name is required"],
      trim: true,
      minlength: [2, "Reference name must be at least 2 characters long"],
      maxlength: [100, "Reference name cannot exceed 100 characters"],
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, "Notes cannot exceed 500 characters"],
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
  },
  { timestamps: true },
);

// Case-insensitive uniqueness so "John Smith" and "john smith" can't both
// be added as separate references from the onboarding dropdown.
referenceSchema.index(
  { name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } },
);

export const Reference = mongoose.model("Reference", referenceSchema);

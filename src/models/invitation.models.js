import mongoose from "mongoose";

const invitationSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      trim: true,
      default: "",
    },
    role: {
      type: String,
      required: [true, "Role is required"],
      enum: ["client"],
      default: "client",
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Invited by user is required"],
    },
    tokenHash: {
      type: String,
      required: [true, "Token hash is required"],
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: [true, "Expiration date is required"],
    },
    acceptedAt: {
      type: Date,
      default: null,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// TTL index — MongoDB will automatically delete expired invitations
invitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for efficient lookups during acceptance
invitationSchema.index({ tokenHash: 1, acceptedAt: 1, revokedAt: 1 });

export const Invitation = mongoose.model("Invitation", invitationSchema);

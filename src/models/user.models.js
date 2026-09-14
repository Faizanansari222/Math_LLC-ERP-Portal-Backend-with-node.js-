import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";

const timesheetSchema = new mongoose.Schema(
  {
    clockInTime: {
      type: Date,
      required: true,
    },
    clockOutTime: {
      type: Date,
    },
    status: {
      type: String,
      enum: ["active", "completed"],
      default: "active",
    },
    totalHours: {
      type: Number,
      default: 0,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, "Notes cannot exceed 500 characters"],
    },
  },
  {
    timestamps: true,
  }
);

const userSchema = mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
    },
    userImage: {
      type: String,
    },
    // E.164 format (e.g. "+14155552671") — staff can be based anywhere,
    // not just the US. See client.models.js for the same format.
    phone: {
      type: String,
      required: true,
      trim: true,
      match: [
        /^\+[1-9]\d{1,14}$/,
        "Please provide a valid phone number, including country code",
      ],
    },
    department: {
      type: String,
      required: true,
      enum: [
        "tax",
        "payroll",
        "bookkeeping",
        "formation",
        "management",
        "social-media",
        "design",
        "development",
        "sales",
      ],
    },

    experience: {
      type: String,
      required: true,
      enum: ["entry-level", "mid-level", "senior-level", "lead-level"],
    },

    status: {
      type: String,
      enum: ["active", "inactive", "on-leave"],
      default: "active",
    },
    role: {
      type: String,
      enum: ["super-admin", "admin", "user", "client"],
      default: "user",
    },
    // For role "client": links this login account to its business/CRM
    // record. Resolved by matching email at account-creation time (see
    // invitation.controllers.js and client.controllers.js).
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      default: null,
    },
    timesheets: [timesheetSchema],
    refreshToken: {
      type: String,
    },
    notificationPreferences: {
      messages: {
        type: Boolean,
        default: true,
      },
    },
    // Hashed password-reset token — never the raw token (same pattern as
    // Invitation.tokenHash). Cleared once used or once a new one is issued.
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      email: this.email,
      firstName: this.firstName,
      lastName: this.lastName,
      experience: this.experience,
      department: this.department,
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
    },
  );
};

userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      _id: this._id,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
    },
  );
};

// Compare entered password with stored hash
userSchema.methods.isCorrectPassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.model("User", userSchema);

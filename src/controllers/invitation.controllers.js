import crypto from "crypto";
import { User } from "../models/user.models.js";
import { Invitation } from "../models/invitation.models.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { sendInvitationEmail } from "../services/mail.service.js";

// ============================================================
// HELPER: Generate and hash invitation token
// ============================================================
const generateInvitationToken = () => {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  return { rawToken, tokenHash };
};

// ============================================================
// HELPER: Generate access & refresh tokens (mirrors user.controllers.js)
// ============================================================
const generateAccessAndRefreshToken = async (userId) => {
  const user = await User.findById(userId);
  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });
  return { accessToken, refreshToken };
};

// ============================================================
// 1. INVITE CLIENT
// POST /api/v1/invitations/client
// ============================================================
const inviteClient = asyncHandler(async (req, res) => {
  const { email, clientName } = req.body;

  // Validate
  if (!email || email.trim() === "") {
    throw new ApiError(400, "Email is required");
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Email format validation
  const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
  if (!emailRegex.test(normalizedEmail)) {
    throw new ApiError(400, "Please provide a valid email address");
  }

  // Check if user already exists in User collection
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw new ApiError(409, "A user with this email already exists");
  }

  // If there is a pending (non-accepted, non-revoked, non-expired) invitation, revoke it first
  const existingPending = await Invitation.findOne({
    email: normalizedEmail,
    acceptedAt: null,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  });
  if (existingPending) {
    existingPending.revokedAt = new Date();
    await existingPending.save({ validateBeforeSave: false });
  }

  // Generate secure token
  const { rawToken, tokenHash } = generateInvitationToken();

  // Create invitation
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  const invitation = await Invitation.create({
    email: normalizedEmail,
    name: clientName?.trim() || "",
    role: "client",
    invitedBy: req.user._id,
    tokenHash,
    expiresAt,
  });

  // Build invitation URL
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const invitationUrl = `${frontendUrl}/accept-invitation/${rawToken}`;

  // Send invitation email
  const invitedByName = `${req.user.firstName} ${req.user.lastName}`;
  const recipientName = clientName?.trim() || normalizedEmail.split("@")[0];

  try {
    await sendInvitationEmail({
      to: normalizedEmail,
      clientName: recipientName,
      invitationUrl,
      invitedByName,
    });
  } catch (emailError) {
    // Log the error but don't fail the invitation creation
    console.error("Failed to send invitation email:", emailError.message);
  }

  // Never return the raw token or tokenHash in the response
  const safeInvitation = await Invitation.findById(invitation._id)
    .populate("invitedBy", "firstName lastName email");

  return res
    .status(201)
    .json(
      new ApiResponse(
        201,
        {
          _id: safeInvitation._id,
          email: safeInvitation.email,
          name: safeInvitation.name,
          role: safeInvitation.role,
          expiresAt: safeInvitation.expiresAt,
          createdAt: safeInvitation.createdAt,
          invitedBy: safeInvitation.invitedBy,
        },
        "Invitation sent successfully",
      ),
    );
});

// ============================================================
// 2. LIST ALL INVITATIONS
// GET /api/v1/invitations
// ============================================================
const getAllInvitations = asyncHandler(async (req, res) => {
  const invitations = await Invitation.find({})
    .populate("invitedBy", "firstName lastName email")
    .sort({ createdAt: -1 });

  const now = new Date();

  const withStatus = invitations.map((inv) => {
    let status = "pending";
    if (inv.acceptedAt) {
      status = "accepted";
    } else if (inv.revokedAt) {
      status = "revoked";
    } else if (inv.expiresAt <= now) {
      status = "expired";
    }

    return {
      _id: inv._id,
      email: inv.email,
      name: inv.name,
      role: inv.role,
      status,
      invitedBy: inv.invitedBy,
      createdAt: inv.createdAt,
      expiresAt: inv.expiresAt,
      acceptedAt: inv.acceptedAt,
      revokedAt: inv.revokedAt,
    };
  });

  return res
    .status(200)
    .json(
      new ApiResponse(200, { invitations: withStatus }, "Invitations fetched successfully"),
    );
});

// ============================================================
// 2. GET / VALIDATE INVITATION
// GET /api/v1/invitations/:token
// ============================================================
const getInvitation = asyncHandler(async (req, res) => {
  const { token } = req.params;

  if (!token) {
    throw new ApiError(400, "Invitation token is required");
  }

  // Hash the incoming token
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const invitation = await Invitation.findOne({ tokenHash });

  if (!invitation) {
    throw new ApiError(404, "Invalid invitation link");
  }

  // Check if already accepted
  if (invitation.acceptedAt) {
    throw new ApiError(400, "This invitation has already been accepted");
  }

  // Check if revoked
  if (invitation.revokedAt) {
    throw new ApiError(400, "This invitation has been revoked");
  }

  // Check if expired
  if (invitation.expiresAt <= new Date()) {
    throw new ApiError(400, "This invitation has expired");
  }

  // Return only safe information
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        valid: true,
      },
      "Invitation is valid",
    ),
  );
});

// ============================================================
// 3. ACCEPT INVITATION
// POST /api/v1/invitations/:token/accept
// ============================================================
const acceptInvitation = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { name, password } = req.body;

  if (!token) {
    throw new ApiError(400, "Invitation token is required");
  }

  if (!name || name.trim() === "") {
    throw new ApiError(400, "Name is required");
  }

  if (!password || password.trim() === "") {
    throw new ApiError(400, "Password is required");
  }

  if (password.length < 8) {
    throw new ApiError(400, "Password must be at least 8 characters long");
  }

  // Hash the incoming token
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const invitation = await Invitation.findOne({ tokenHash });

  if (!invitation) {
    throw new ApiError(404, "Invalid invitation link");
  }

  // Check if already accepted
  if (invitation.acceptedAt) {
    throw new ApiError(400, "This invitation has already been accepted");
  }

  // Check if revoked
  if (invitation.revokedAt) {
    throw new ApiError(400, "This invitation has been revoked");
  }

  // Check if expired
  if (invitation.expiresAt <= new Date()) {
    throw new ApiError(400, "This invitation has expired");
  }

  // Check if user already exists
  const existingUser = await User.findOne({ email: invitation.email });
  if (existingUser) {
    throw new ApiError(409, "A user with this email already exists");
  }

  // Parse name into firstName and lastName
  const nameParts = name.trim().split(/\s+/);
  const firstName = nameParts[0];
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

  // Create the client user
  // The User model's pre-save hook will hash the password via bcryptjs
  const user = await User.create({
    firstName,
    lastName,
    email: invitation.email,
    password,
    phone: "N/A",
    department: "management",
    experience: "entry-level",
    role: "client",
  });

  if (!user) {
    throw new ApiError(500, "Something went wrong while creating the user");
  }

  // Mark invitation as accepted
  invitation.acceptedAt = new Date();
  await invitation.save({ validateBeforeSave: false });

  // Generate tokens (same format as existing login)
  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id,
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken",
  );

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  };

  return res
    .status(201)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        201,
        { user: loggedInUser, accessToken, refreshToken },
        "Account created and invitation accepted successfully",
      ),
    );
});

// ============================================================
// 4. RESEND INVITATION
// POST /api/v1/invitations/:id/resend
// ============================================================
const resendInvitation = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    throw new ApiError(400, "Invitation ID is required");
  }

  const invitation = await Invitation.findById(id);

  if (!invitation) {
    throw new ApiError(404, "Invitation not found");
  }

  // Check if already accepted
  if (invitation.acceptedAt) {
    throw new ApiError(400, "This invitation has already been accepted");
  }

  // Revoke the old invitation
  invitation.revokedAt = new Date();
  await invitation.save({ validateBeforeSave: false });

  // Generate a completely new token
  const { rawToken, tokenHash } = generateInvitationToken();

  // Create a new invitation with the new token
  const newExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const newInvitation = await Invitation.create({
    email: invitation.email,
    name: invitation.name,
    role: invitation.role,
    invitedBy: req.user._id,
    tokenHash,
    expiresAt: newExpiresAt,
  });

  // Build new invitation URL
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const invitationUrl = `${frontendUrl}/accept-invitation/${rawToken}`;

  // Send new invitation email
  const invitedByName = `${req.user.firstName} ${req.user.lastName}`;
  const recipientName = invitation.name?.trim() || invitation.email.split("@")[0];

  try {
    await sendInvitationEmail({
      to: invitation.email,
      clientName: recipientName,
      invitationUrl,
      invitedByName,
    });
  } catch (emailError) {
    console.error("Failed to resend invitation email:", emailError.message);
  }

  // Return safe data
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        _id: newInvitation._id,
        email: newInvitation.email,
        name: newInvitation.name,
        role: newInvitation.role,
        expiresAt: newInvitation.expiresAt,
        createdAt: newInvitation.createdAt,
      },
      "Invitation resent successfully",
    ),
  );
});

// ============================================================
// 5. REVOKE INVITATION
// DELETE /api/v1/invitations/:id
// ============================================================
const revokeInvitation = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    throw new ApiError(400, "Invitation ID is required");
  }

  const invitation = await Invitation.findById(id);

  if (!invitation) {
    throw new ApiError(404, "Invitation not found");
  }

  // Check if already accepted
  if (invitation.acceptedAt) {
    throw new ApiError(400, "Cannot revoke an already accepted invitation");
  }

  // Check if already revoked
  if (invitation.revokedAt) {
    throw new ApiError(400, "Invitation is already revoked");
  }

  // Soft revoke — set revokedAt
  invitation.revokedAt = new Date();
  await invitation.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { _id: invitation._id, email: invitation.email },
        "Invitation revoked successfully",
      ),
    );
});

export {
  inviteClient,
  getAllInvitations,
  getInvitation,
  acceptInvitation,
  resendInvitation,
  revokeInvitation,
};

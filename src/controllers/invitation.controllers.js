import crypto from "crypto";
import { User } from "../models/user.models.js";
import { Invitation } from "../models/invitation.models.js";
import { Client } from "../models/client.models.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {
  sendInvitationEmail,
  sendStaffInvitationEmail,
} from "../services/mail.service.js";

const EMAIL_REGEX = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
const PHONE_REGEX = /^\(\d{3}\)\s\d{3}-\d{4}$/;
const CLIENT_TYPES = ["individual", "business", "non-profit", "trust", "estate"];
const CLIENT_SERVICES = [
  "tax-filing",
  "tax-planning",
  "payroll",
  "bookkeeping",
  "audit",
  "business-formation",
  "financial-reporting",
  "consulting",
  "other",
];
const STAFF_DEPARTMENTS = [
  "tax",
  "payroll",
  "bookkeeping",
  "formation",
  "management",
  "social-media",
  "design",
  "development",
];
const STAFF_EXPERIENCE_LEVELS = [
  "entry-level",
  "mid-level",
  "senior-level",
  "lead-level",
];

// ============================================================
// HELPER: Validate the CRM client-profile fields submitted alongside a
// client invitation acceptance. Mirrors the required-field checks in
// client.controllers.js#createClient, since this is the same record.
// ============================================================
const validateClientProfileFields = (fields) => {
  const {
    clientType,
    firstName,
    lastName,
    businessName,
    phone,
    address,
    city,
    state,
    zipCode,
    services,
  } = fields;

  if (!clientType || !CLIENT_TYPES.includes(clientType)) {
    throw new ApiError(400, `Client type must be one of: ${CLIENT_TYPES.join(", ")}`);
  }

  if (["individual", "trust", "estate"].includes(clientType)) {
    if (!firstName?.trim() || !lastName?.trim()) {
      throw new ApiError(400, "First and last name are required");
    }
  }

  if (["business", "non-profit"].includes(clientType)) {
    if (!businessName?.trim()) {
      throw new ApiError(400, "Business name is required");
    }
  }

  if (!phone || !PHONE_REGEX.test(phone.trim())) {
    throw new ApiError(400, "Please provide a valid phone number in format (XXX) XXX-XXXX");
  }

  if (!address?.trim()) throw new ApiError(400, "Street address is required");
  if (!city?.trim()) throw new ApiError(400, "City is required");
  if (!state?.trim()) throw new ApiError(400, "State is required");
  if (!zipCode?.trim()) throw new ApiError(400, "Zip code is required");

  if (!services || !Array.isArray(services) || services.length === 0) {
    throw new ApiError(400, "Please select at least one service");
  }

  const invalidService = services.find((s) => !CLIENT_SERVICES.includes(s));
  if (invalidService) {
    throw new ApiError(400, `Invalid service: ${invalidService}`);
  }
};

// ============================================================
// HELPER: Link a newly created client-portal User to its CRM Client
// record — reusing an existing record (created earlier by an admin
// and matched by email) if one exists, otherwise creating a fresh
// one from the profile the client just filled in on the invitation
// form. Bidirectional link (Client.portalUser <-> User.client) is the
// same convention used by client.controllers.js#createClient.
// ============================================================
const linkOrCreateClientProfile = async (user, profileFields) => {
  let client = await Client.findOne({ email: user.email });

  if (client) {
    if (!client.portalUser) {
      client.portalUser = user._id;
      user.client = client._id;
      await Promise.all([
        client.save({ validateBeforeSave: false }),
        user.save({ validateBeforeSave: false }),
      ]);
    }
    return client;
  }

  client = await Client.create({
    ...profileFields,
    email: user.email,
    status: "active",
    portalUser: user._id,
  });

  user.client = client._id;
  await user.save({ validateBeforeSave: false });

  return client;
};

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
// HELPER: Dispatch the right invitation email template for the role
// ============================================================
const sendInvitationEmailForRole = async ({
  role,
  to,
  name,
  invitationUrl,
  invitedByName,
  department,
}) => {
  const recipientName = name?.trim() || to.split("@")[0];

  if (role === "client") {
    return sendInvitationEmail({
      to,
      clientName: recipientName,
      invitationUrl,
      invitedByName,
    });
  }

  return sendStaffInvitationEmail({
    to,
    name: recipientName,
    invitationUrl,
    invitedByName,
    role,
    department,
  });
};

// ============================================================
// HELPER: Shared invitation creation, used by both inviteClient and
// inviteStaff. Revokes any still-pending invitation for the same
// email, mints a fresh hashed token, persists the invitation, and
// (best-effort) sends the appropriate email.
// ============================================================
const createAndSendInvitation = async ({
  email,
  name,
  role,
  department,
  experience,
  invitedBy,
  invitedByName,
}) => {
  const normalizedEmail = email.toLowerCase().trim();

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

  const { rawToken, tokenHash } = generateInvitationToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  const invitation = await Invitation.create({
    email: normalizedEmail,
    name: name?.trim() || "",
    role,
    department,
    experience,
    invitedBy,
    tokenHash,
    expiresAt,
  });

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5174";
  const invitationUrl = `${frontendUrl}/accept-invitation/${rawToken}`;

  try {
    await sendInvitationEmailForRole({
      role,
      to: normalizedEmail,
      name: name?.trim(),
      invitationUrl,
      invitedByName,
      department,
    });
  } catch (emailError) {
    // Log the error but don't fail the invitation creation
    console.error("Failed to send invitation email:", emailError.message);
  }

  return Invitation.findById(invitation._id).populate(
    "invitedBy",
    "firstName lastName email",
  );
};

const toSafeInvitation = (invitation) => ({
  _id: invitation._id,
  email: invitation.email,
  name: invitation.name,
  role: invitation.role,
  department: invitation.department,
  experience: invitation.experience,
  expiresAt: invitation.expiresAt,
  createdAt: invitation.createdAt,
  invitedBy: invitation.invitedBy,
});

// ============================================================
// 1. INVITE CLIENT
// POST /api/v1/invitations/client
// ============================================================
const inviteClient = asyncHandler(async (req, res) => {
  const { email, clientName } = req.body;

  if (!email || email.trim() === "") {
    throw new ApiError(400, "Email is required");
  }

  const normalizedEmail = email.toLowerCase().trim();

  if (!EMAIL_REGEX.test(normalizedEmail)) {
    throw new ApiError(400, "Please provide a valid email address");
  }

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw new ApiError(409, "A user with this email already exists");
  }

  const safeInvitation = await createAndSendInvitation({
    email: normalizedEmail,
    name: clientName,
    role: "client",
    invitedBy: req.user._id,
    invitedByName: `${req.user.firstName} ${req.user.lastName}`,
  });

  return res
    .status(201)
    .json(
      new ApiResponse(
        201,
        toSafeInvitation(safeInvitation),
        "Invitation sent successfully",
      ),
    );
});

// ============================================================
// 1b. INVITE STAFF (employee/admin)
// POST /api/v1/invitations/staff
// ============================================================
const inviteStaff = asyncHandler(async (req, res) => {
  const { email, name, role, department, experience } = req.body;

  if (!email || email.trim() === "") {
    throw new ApiError(400, "Email is required");
  }

  const normalizedEmail = email.toLowerCase().trim();

  if (!EMAIL_REGEX.test(normalizedEmail)) {
    throw new ApiError(400, "Please provide a valid email address");
  }

  if (!["admin", "user"].includes(role)) {
    throw new ApiError(400, "Role must be either 'admin' or 'user'");
  }

  // Only a super-admin can grant admin access via invitation — an admin
  // inviting another admin would be a privilege-escalation path.
  if (role === "admin" && req.user.role !== "super-admin") {
    throw new ApiError(403, "Only a super admin can invite a new admin");
  }

  if (!department || !STAFF_DEPARTMENTS.includes(department)) {
    throw new ApiError(
      400,
      `Department must be one of: ${STAFF_DEPARTMENTS.join(", ")}`,
    );
  }

  if (!experience || !STAFF_EXPERIENCE_LEVELS.includes(experience)) {
    throw new ApiError(
      400,
      `Experience level must be one of: ${STAFF_EXPERIENCE_LEVELS.join(", ")}`,
    );
  }

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw new ApiError(409, "A user with this email already exists");
  }

  const safeInvitation = await createAndSendInvitation({
    email: normalizedEmail,
    name,
    role,
    department,
    experience,
    invitedBy: req.user._id,
    invitedByName: `${req.user.firstName} ${req.user.lastName}`,
  });

  return res
    .status(201)
    .json(
      new ApiResponse(
        201,
        toSafeInvitation(safeInvitation),
        "Invitation sent successfully",
      ),
    );
});

// ============================================================
// 2. LIST ALL INVITATIONS
// GET /api/v1/invitations
// ============================================================
const getAllInvitations = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);
  const skip = (page - 1) * limit;

  // Optional ?role=client or ?role=admin,user — keeps the Client
  // Management and Employee Management invitation lists from bleeding
  // into each other.
  const filter = {};
  if (req.query.role) {
    const roles = req.query.role.split(",").map((r) => r.trim()).filter(Boolean);
    if (roles.length > 0) filter.role = { $in: roles };
  }

  const [invitations, totalInvitations] = await Promise.all([
    Invitation.find(filter)
      .populate("invitedBy", "firstName lastName email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Invitation.countDocuments(filter),
  ]);

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
      department: inv.department,
      experience: inv.experience,
      status,
      invitedBy: inv.invitedBy,
      createdAt: inv.createdAt,
      expiresAt: inv.expiresAt,
      acceptedAt: inv.acceptedAt,
      revokedAt: inv.revokedAt,
    };
  });

  const totalPages = Math.ceil(totalInvitations / limit);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        invitations: withStatus,
        pagination: {
          currentPage: page,
          totalPages,
          totalInvitations,
          limit,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      },
      "Invitations fetched successfully",
    ),
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
        name: invitation.name,
        role: invitation.role,
        department: invitation.department,
        experience: invitation.experience,
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
  const {
    name,
    password,
    confirmPassword,
    phone,
    // CRM profile fields, submitted only by client invitations — same
    // shape as client.controllers.js#createClient's request body.
    clientType,
    businessName,
    alternativePhone,
    industry,
    website,
    annualRevenue,
    employeeCount,
    taxId,
    address,
    city,
    state,
    zipCode,
    country,
    services,
    preferredContact,
    preferredLanguage,
    taxFilingMonth,
    accountingYear,
    notes,
    marketingConsent,
    businessStructure,
  } = req.body;

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

  if (!confirmPassword || confirmPassword !== password) {
    throw new ApiError(400, "Passwords do not match");
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

  // Staff accounts need a real phone number (the User schema requires
  // one). Client accounts now build a full CRM profile on this same
  // form, so their phone (and the rest of the profile) is validated
  // against the Client model's rules below.
  const isStaffInvite = invitation.role !== "client";
  if (isStaffInvite && (!phone || phone.trim() === "")) {
    throw new ApiError(400, "Phone number is required");
  }

  // Parse name into firstName/lastName up front — needed for the client
  // profile validation below (individual/trust/estate clients require it).
  const nameParts = (name || "").trim().split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] || "";
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

  if (!isStaffInvite) {
    validateClientProfileFields({
      clientType,
      firstName,
      lastName,
      businessName,
      phone,
      address,
      city,
      state,
      zipCode,
      services,
    });
  }

  // Check if user already exists
  const existingUser = await User.findOne({ email: invitation.email });
  if (existingUser) {
    throw new ApiError(409, "A user with this email already exists");
  }

  // Atomically claim the invitation before creating the account. This closes the
  // race window where two concurrent requests (or a replayed request) could both
  // pass the checks above and create duplicate accounts / double-accept the token.
  const claimedInvitation = await Invitation.findOneAndUpdate(
    {
      _id: invitation._id,
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    },
    { $set: { acceptedAt: new Date() } },
    { new: true },
  );

  if (!claimedInvitation) {
    throw new ApiError(409, "This invitation has already been used.");
  }

  const releaseInvitationClaim = () =>
    Invitation.updateOne(
      { _id: claimedInvitation._id },
      { $set: { acceptedAt: null } },
    );

  let user;
  try {
    // The User model's pre-save hook will hash the password via bcryptjs
    user = await User.create(
      isStaffInvite
        ? {
            firstName,
            lastName,
            email: invitation.email,
            password,
            phone: phone.trim(),
            department: invitation.department,
            experience: invitation.experience,
            role: invitation.role,
          }
        : {
            firstName,
            lastName,
            email: invitation.email,
            password,
            phone: phone.trim(),
            department: "management",
            experience: "entry-level",
            role: "client",
          },
    );
  } catch (createError) {
    // Release the claim so a genuine retry isn't permanently locked out
    await releaseInvitationClaim();

    if (createError.code === 11000) {
      throw new ApiError(409, "A user with this email already exists");
    }
    throw createError;
  }

  if (!isStaffInvite) {
    try {
      await linkOrCreateClientProfile(user, {
        clientType,
        firstName,
        lastName,
        businessName,
        phone: phone.trim(),
        alternativePhone,
        industry,
        website,
        annualRevenue,
        employeeCount,
        taxId,
        address,
        city,
        state,
        zipCode,
        country,
        services,
        preferredContact,
        preferredLanguage,
        taxFilingMonth,
        accountingYear,
        notes,
        // referralSource is intentionally NOT accepted here — it's an
        // admin-only field (who/what actually brought this client in),
        // set manually in Client Management, never by the client's own
        // invitation-acceptance form.
        marketingConsent,
        businessStructure,
      });
    } catch (clientCreateError) {
      // Roll back the user account too — a client login with no CRM
      // profile behind it is a broken state, and the invitation should
      // stay usable for a retry.
      await User.deleteOne({ _id: user._id });
      await releaseInvitationClaim();

      if (clientCreateError.code === 11000) {
        throw new ApiError(409, "A client with this email already exists");
      }
      if (clientCreateError.name === "ValidationError") {
        const firstMessage = Object.values(clientCreateError.errors)[0]?.message;
        throw new ApiError(400, firstMessage || "Invalid client profile data");
      }
      throw clientCreateError;
    }
  }

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

  // Check if already revoked — a revoked invitation must not be resurrected via resend
  if (invitation.revokedAt) {
    throw new ApiError(400, "This invitation has been revoked. Please send a new invitation instead.");
  }

  // Revoke the old invitation
  invitation.revokedAt = new Date();
  await invitation.save({ validateBeforeSave: false });

  // Generate a completely new token
  const { rawToken, tokenHash } = generateInvitationToken();

  // Create a new invitation with the new token, carrying forward the
  // original role/department/experience so a resend can't accidentally
  // downgrade a staff invite back to defaults
  const newExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const newInvitation = await Invitation.create({
    email: invitation.email,
    name: invitation.name,
    role: invitation.role,
    department: invitation.department,
    experience: invitation.experience,
    invitedBy: req.user._id,
    tokenHash,
    expiresAt: newExpiresAt,
  });

  // Build new invitation URL
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const invitationUrl = `${frontendUrl}/accept-invitation/${rawToken}`;

  const invitedByName = `${req.user.firstName} ${req.user.lastName}`;

  try {
    await sendInvitationEmailForRole({
      role: invitation.role,
      to: invitation.email,
      name: invitation.name,
      invitationUrl,
      invitedByName,
      department: invitation.department,
    });
  } catch (emailError) {
    console.error("Failed to resend invitation email:", emailError.message);
  }

  // Return safe data
  return res.status(200).json(
    new ApiResponse(
      200,
      toSafeInvitation(newInvitation),
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
  inviteStaff,
  getAllInvitations,
  getInvitation,
  acceptInvitation,
  resendInvitation,
  revokeInvitation,
};

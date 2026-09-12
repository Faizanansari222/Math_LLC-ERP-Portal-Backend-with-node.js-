import { Client } from "../models/client.models.js";
import { User } from "../models/user.models.js";
import { Reference } from "../models/reference.models.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { sendClientEmail, sendWelcomeEmail, sendTaxStatusEmail } from "../services/mail.service.js";

// ============================================================
// CREATE CLIENT
// POST /api/v1/clients
// ============================================================
const createClient = asyncHandler(async (req, res) => {
  const {
    clientType,
    firstName,
    lastName,
    businessName,
    email,
    phone,
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
    referralSource,
    reference,
    marketingConsent,
    status,
    assignedTo,
    taxFilingStatus,
    accountingMethod,
    fiscalYearEnd,
    businessStructure,
  } = req.body;

  // Basic validation
  if (!clientType) {
    throw new ApiError(400, "Client type is required");
  }

  if (!email) {
    throw new ApiError(400, "Email address is required");
  }

  if (!phone) {
    throw new ApiError(400, "Phone number is required");
  }

  if (!address) {
    throw new ApiError(400, "Street address is required");
  }

  if (!city) {
    throw new ApiError(400, "City is required");
  }

  if (!state) {
    throw new ApiError(400, "State is required");
  }

  if (!zipCode) {
    throw new ApiError(400, "Zip code is required");
  }

  if (!services || !Array.isArray(services) || services.length === 0) {
    throw new ApiError(400, "Please select at least one service");
  }

  // Check duplicate email
  const existingClient = await Client.findOne({
    email: email.toLowerCase().trim(),
  });

  if (existingClient) {
    throw new ApiError(
      409,
      "A client with this email already exists",
    );
  }

  // Validate the selected reference (from the manually-managed reference
  // list) and always trust its saved name over whatever the client sent,
  // so the denormalized referralSource label can't drift or be spoofed.
  let referenceDoc = null;

  if (reference) {
    referenceDoc = await Reference.findById(reference);

    if (!referenceDoc) {
      throw new ApiError(404, "Selected reference not found");
    }
  }

  // Validate assigned user
  let assignedToName;

  if (assignedTo) {
    const user = await User.findById(assignedTo);

    if (!user) {
      throw new ApiError(404, "Assigned user not found");
    }

    assignedToName = `${user.firstName} ${user.lastName}`.trim();
  }

  // If a client-portal login already exists for this email (invited before
  // the CRM profile existed), link the two records together now.
  const existingPortalUser = await User.findOne({
    email: email.toLowerCase().trim(),
    role: "client",
    client: null,
  });

  const client = await Client.create({
    clientType,

    firstName,
    lastName,
    businessName,

    email: email.toLowerCase().trim(),
    phone,
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
    referralSource: referenceDoc ? referenceDoc.name : referralSource,
    reference: referenceDoc ? referenceDoc._id : null,
    marketingConsent,

    status,
    assignedTo,
    assignedToName,

    taxFilingStatus,
    accountingMethod,
    fiscalYearEnd,
    businessStructure,
  });

  if (existingPortalUser) {
    client.portalUser = existingPortalUser._id;
    existingPortalUser.client = client._id;
    await Promise.all([
      client.save({ validateBeforeSave: false }),
      existingPortalUser.save({ validateBeforeSave: false }),
    ]);
  }

  const createdClient = await Client.findById(client._id)
    .populate("assignedTo", "firstName lastName email role department")
    .populate("portalUser", "firstName lastName email")
    .populate("reference", "name status");

  if (!createdClient) {
    throw new ApiError(
      500,
      "Something went wrong while creating the client",
    );
  }

  return res
    .status(201)
    .json(
      new ApiResponse(
        201,
        createdClient,
        "Client created successfully",
      ),
    );
});

// ============================================================
// GET ALL CLIENTS
// GET /api/v1/clients
// ============================================================
const getAllClients = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);

  const limit = Math.min(
    Math.max(parseInt(req.query.limit) || 10, 1),
    100,
  );

  const skip = (page - 1) * limit;

  const {
    search,
    status,
    clientType,
    assignedTo,
    industry,
    taxFilingStatus,
    preferredContact,
  } = req.query;

  const filter = {};

  // Filters
  if (status) {
    filter.status = status;
  }

  if (clientType) {
    filter.clientType = clientType;
  }

  if (assignedTo) {
    filter.assignedTo = assignedTo;
  }

  if (industry) {
    filter.industry = industry;
  }

  if (taxFilingStatus) {
    filter.taxFilingStatus = taxFilingStatus;
  }

  if (preferredContact) {
    filter.preferredContact = preferredContact;
  }

  // Search
  if (search?.trim()) {
    const searchTerm = search.trim();

    filter.$or = [
      {
        firstName: {
          $regex: searchTerm,
          $options: "i",
        },
      },
      {
        lastName: {
          $regex: searchTerm,
          $options: "i",
        },
      },
      {
        businessName: {
          $regex: searchTerm,
          $options: "i",
        },
      },
      {
        email: {
          $regex: searchTerm,
          $options: "i",
        },
      },
      {
        phone: {
          $regex: searchTerm,
          $options: "i",
        },
      },
      {
        taxId: {
          $regex: searchTerm,
          $options: "i",
        },
      },
    ];
  }

  const [clients, totalClients] = await Promise.all([
    Client.find(filter)
      .populate(
        "assignedTo",
        "firstName lastName email role department",
      )
      .populate("portalUser", "firstName lastName email")
      .populate("reference", "name status")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),

    Client.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(totalClients / limit);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        clients,

        pagination: {
          currentPage: page,
          totalPages,
          totalClients,
          limit,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      },

      "Clients fetched successfully",
    ),
  );
});

// ============================================================
// GET CLIENT BY ID
// GET /api/v1/clients/:clientId
// ============================================================
const getClientById = asyncHandler(async (req, res) => {
  const { clientId } = req.params;

  const client = await Client.findById(clientId)
    .populate("assignedTo", "firstName lastName email role department")
    .populate("portalUser", "firstName lastName email")
    .populate("reference", "name status");

  if (!client) {
    throw new ApiError(404, "Client not found");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        client,
        "Client fetched successfully",
      ),
    );
});

// ============================================================
// GET MY CLIENT PROFILE (logged-in client portal user)
// GET /api/v1/clients/me
// ============================================================
const getMyClientProfile = asyncHandler(async (req, res) => {
  if (!req.user.client) {
    throw new ApiError(
      404,
      "No client profile is linked to this account yet. Please contact your account manager.",
    );
  }

  const client = await Client.findById(req.user.client).populate(
    "assignedTo",
    "firstName lastName email department",
  );

  if (!client) {
    throw new ApiError(404, "Client profile not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, client, "Client profile fetched successfully"));
});

// ============================================================
// UPDATE CLIENT
// PATCH /api/v1/clients/:clientId
// ============================================================
const updateClient = asyncHandler(async (req, res) => {
  const { clientId } = req.params;

  if (!req.body || Object.keys(req.body).length === 0) {
    throw new ApiError(400, "Update data is required");
  }

  // Prevent changing these fields
  delete req.body._id;
  delete req.body.createdAt;
  delete req.body.updatedAt;

  // Check email uniqueness
  if (req.body.email) {
    const email = req.body.email.toLowerCase().trim();

    const existingClient = await Client.findOne({
      email,
      _id: { $ne: clientId },
    });

    if (existingClient) {
      throw new ApiError(
        409,
        "Another client is already using this email",
      );
    }

    req.body.email = email;
  }

  // Validate the selected reference and re-derive the denormalized
  // referralSource label from it, same as on create. Sending an empty
  // value clears the link (e.g. switching to a custom "Other" referrer).
  if (Object.prototype.hasOwnProperty.call(req.body, "reference")) {
    if (req.body.reference) {
      const referenceDoc = await Reference.findById(req.body.reference);

      if (!referenceDoc) {
        throw new ApiError(404, "Selected reference not found");
      }

      req.body.reference = referenceDoc._id;
      req.body.referralSource = referenceDoc.name;
    } else {
      req.body.reference = null;
    }
  }

  // Validate assigned user
  if (req.body.assignedTo) {
    const user = await User.findById(req.body.assignedTo);

    if (!user) {
      throw new ApiError(404, "Assigned user not found");
    }

    req.body.assignedToName =
      `${user.firstName} ${user.lastName}`.trim();
  }

  const updatedClient = await Client.findByIdAndUpdate(
    clientId,
    {
      $set: req.body,
    },
    {
      new: true,
      runValidators: true,
    },
  )
    .populate("assignedTo", "firstName lastName email role department")
    .populate("reference", "name status");

  if (!updatedClient) {
    throw new ApiError(404, "Client not found");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updatedClient,
        "Client updated successfully",
      ),
    );
});

// ============================================================
// DELETE CLIENT
// DELETE /api/v1/clients/:clientId
// ============================================================
const deleteClient = asyncHandler(async (req, res) => {
  const { clientId } = req.params;

  const client = await Client.findByIdAndDelete(clientId);

  if (!client) {
    throw new ApiError(404, "Client not found");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        {},
        "Client deleted successfully",
      ),
    );
});

// ============================================================
// ASSIGN CLIENT
// PATCH /api/v1/clients/:clientId/assign
// ============================================================
const assignClient = asyncHandler(async (req, res) => {
  const { clientId } = req.params;
  const { assignedTo } = req.body;

  if (!assignedTo) {
    throw new ApiError(400, "Assigned user ID is required");
  }

  const user = await User.findById(assignedTo);

  if (!user) {
    throw new ApiError(404, "Assigned user not found");
  }

  const assignedToName =
    `${user.firstName} ${user.lastName}`.trim();

  const client = await Client.findByIdAndUpdate(
    clientId,
    {
      $set: {
        assignedTo: user._id,
        assignedToName,
      },
    },
    {
      new: true,
      runValidators: true,
    },
  ).populate(
    "assignedTo",
    "firstName lastName email role department",
  );

  if (!client) {
    throw new ApiError(404, "Client not found");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        client,
        "Client assigned successfully",
      ),
    );
});

// ============================================================
// UNASSIGN CLIENT
// PATCH /api/v1/clients/:clientId/unassign
// ============================================================
const unassignClient = asyncHandler(async (req, res) => {
  const { clientId } = req.params;

  const client = await Client.findByIdAndUpdate(
    clientId,
    {
      $unset: {
        assignedTo: 1,
        assignedToName: 1,
      },
    },
    {
      new: true,
    },
  ).populate(
    "assignedTo",
    "firstName lastName email role department",
  );

  if (!client) {
    throw new ApiError(404, "Client not found");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        client,
        "Client unassigned successfully",
      ),
    );
});

// ============================================================
// UPDATE CLIENT STATUS
// PATCH /api/v1/clients/:clientId/status
// ============================================================
const updateClientStatus = asyncHandler(async (req, res) => {
  const { clientId } = req.params;
  const { status } = req.body;

  const allowedStatuses = [
    "active",
    "pending",
    "inactive",
    "on-hold",
  ];

  if (!status) {
    throw new ApiError(400, "Status is required");
  }

  if (!allowedStatuses.includes(status)) {
    throw new ApiError(
      400,
      `Invalid status. Allowed values: ${allowedStatuses.join(", ")}`,
    );
  }

  const client = await Client.findByIdAndUpdate(
    clientId,
    {
      $set: {
        status,
      },
    },
    {
      new: true,
      runValidators: true,
    },
  ).populate(
    "assignedTo",
    "firstName lastName email role department",
  );

  if (!client) {
    throw new ApiError(404, "Client not found");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        client,
        "Client status updated successfully",
      ),
    );
});

// ============================================================
// UPDATE TAX FILING STATUS
// PATCH /api/v1/clients/:clientId/tax-status
// ============================================================
const updateTaxFilingStatus = asyncHandler(async (req, res) => {
  const { clientId } = req.params;
  const { taxFilingStatus } = req.body;

  const allowedStatuses = [
    "not-started",
    "in-progress",
    "review",
    "filed",
    "amended",
  ];

  if (!taxFilingStatus) {
    throw new ApiError(
      400,
      "Tax filing status is required",
    );
  }

  if (!allowedStatuses.includes(taxFilingStatus)) {
    throw new ApiError(
      400,
      `Invalid tax filing status. Allowed values: ${allowedStatuses.join(
        ", ",
      )}`,
    );
  }

  const client = await Client.findByIdAndUpdate(
    clientId,
    {
      $set: {
        taxFilingStatus,
      },
    },
    {
      new: true,
      runValidators: true,
    },
  ).populate(
    "assignedTo",
    "firstName lastName email role department",
  );

  if (!client) {
    throw new ApiError(404, "Client not found");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        client,
        "Tax filing status updated successfully",
      ),
    );
});

// ============================================================
// CLIENT STATISTICS
// GET /api/v1/clients/statistics
// ============================================================
const getClientStatistics = asyncHandler(async (req, res) => {
  const [
    totalClients,
    activeClients,
    pendingClients,
    inactiveClients,
    onHoldClients,
    individualClients,
    businessClients,
  ] = await Promise.all([
    Client.countDocuments(),

    Client.countDocuments({
      status: "active",
    }),

    Client.countDocuments({
      status: "pending",
    }),

    Client.countDocuments({
      status: "inactive",
    }),

    Client.countDocuments({
      status: "on-hold",
    }),

    Client.countDocuments({
      clientType: "individual",
    }),

    Client.countDocuments({
      clientType: "business",
    }),
  ]);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        totalClients,
        activeClients,
        pendingClients,
        inactiveClients,
        onHoldClients,
        individualClients,
        businessClients,
      },
      "Client statistics fetched successfully",
    ),
  );
});

// ============================================================
// SEND EMAIL TO CLIENT
// POST /api/v1/clients/:clientId/send-email
// ============================================================
const sendEmailToClient = asyncHandler(async (req, res) => {
  const { clientId } = req.params;
  const { subject, message } = req.body;

  if (!subject?.trim()) {
    throw new ApiError(400, "Email subject is required");
  }

  if (!message?.trim()) {
    throw new ApiError(400, "Email message is required");
  }

  const client = await Client.findById(clientId);

  if (!client) {
    throw new ApiError(404, "Client not found");
  }

  const result = await sendClientEmail({
    to: client.email,
    subject: subject.trim(),
    message: message.trim(),
    clientName: client.firstName,
  });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        {
          messageId: result.messageId,
          to: client.email,
          accepted: result.accepted,
        },
        "Email sent successfully",
      ),
    );
});

// ============================================================
// SEND WELCOME EMAIL TO CLIENT
// POST /api/v1/clients/:clientId/send-welcome
// ============================================================
const sendWelcomeEmailToClient = asyncHandler(async (req, res) => {
  const { clientId } = req.params;

  const client = await Client.findById(clientId);

  if (!client) {
    throw new ApiError(404, "Client not found");
  }

  const result = await sendWelcomeEmail({
    to: client.email,
    clientName: client.firstName,
    services: client.services,
  });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        {
          messageId: result.messageId,
          to: client.email,
        },
        "Welcome email sent successfully",
      ),
    );
});

// ============================================================
// SEND TAX STATUS UPDATE EMAIL
// POST /api/v1/clients/:clientId/send-tax-update
// ============================================================
const sendTaxUpdateEmail = asyncHandler(async (req, res) => {
  const { clientId } = req.params;
  const { taxFilingStatus } = req.body;

  if (!taxFilingStatus) {
    throw new ApiError(400, "Tax filing status is required");
  }

  const client = await Client.findById(clientId);

  if (!client) {
    throw new ApiError(404, "Client not found");
  }

  const result = await sendTaxStatusEmail({
    to: client.email,
    clientName: client.firstName,
    taxFilingStatus,
    businessName: client.businessName,
  });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        {
          messageId: result.messageId,
          to: client.email,
        },
        "Tax status email sent successfully",
      ),
    );
});

export {
  createClient,
  getAllClients,
  getClientById,
  getMyClientProfile,
  updateClient,
  deleteClient,
  assignClient,
  unassignClient,
  updateClientStatus,
  updateTaxFilingStatus,
  getClientStatistics,
  sendEmailToClient,
  sendWelcomeEmailToClient,
  sendTaxUpdateEmail,
};
import { Reference } from "../models/reference.models.js";
import { Client } from "../models/client.models.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";

// ============================================================
// CREATE REFERENCE
// POST /api/v1/references
// ============================================================
const createReference = asyncHandler(async (req, res) => {
  const { name, notes, status } = req.body;

  if (!name?.trim()) {
    throw new ApiError(400, "Reference name is required");
  }

  const existing = await Reference.findOne({
    name: name.trim(),
  }).collation({ locale: "en", strength: 2 });

  if (existing) {
    throw new ApiError(409, "A reference with this name already exists");
  }

  const reference = await Reference.create({
    name: name.trim(),
    notes: notes?.trim() || undefined,
    status: status === "inactive" ? "inactive" : "active",
    createdBy: req.user._id,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, reference, "Reference added successfully"));
});

// ============================================================
// GET ALL REFERENCES
// GET /api/v1/references
// ============================================================
const getAllReferences = asyncHandler(async (req, res) => {
  const { status, search } = req.query;

  const filter = {};

  if (status) {
    filter.status = status;
  }

  if (search?.trim()) {
    filter.name = { $regex: search.trim(), $options: "i" };
  }

  const references = await Reference.find(filter)
    .populate("createdBy", "firstName lastName email")
    .sort({ name: 1 })
    .lean();

  // Attach how many clients currently point at each reference, so the
  // admin UI can warn before deleting one that's in use.
  const counts = await Client.aggregate([
    { $match: { reference: { $ne: null } } },
    { $group: { _id: "$reference", count: { $sum: 1 } } },
  ]);

  const countMap = new Map(counts.map((c) => [String(c._id), c.count]));

  const referencesWithCounts = references.map((ref) => ({
    ...ref,
    clientCount: countMap.get(String(ref._id)) || 0,
  }));

  return res
    .status(200)
    .json(
      new ApiResponse(200, referencesWithCounts, "References fetched successfully"),
    );
});

// ============================================================
// GET REFERENCE BY ID
// GET /api/v1/references/:referenceId
// ============================================================
const getReferenceById = asyncHandler(async (req, res) => {
  const { referenceId } = req.params;

  const reference = await Reference.findById(referenceId).populate(
    "createdBy",
    "firstName lastName email",
  );

  if (!reference) {
    throw new ApiError(404, "Reference not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, reference, "Reference fetched successfully"));
});

// ============================================================
// UPDATE REFERENCE
// PATCH /api/v1/references/:referenceId
// ============================================================
const updateReference = asyncHandler(async (req, res) => {
  const { referenceId } = req.params;
  const { name, notes, status } = req.body;

  const reference = await Reference.findById(referenceId);

  if (!reference) {
    throw new ApiError(404, "Reference not found");
  }

  if (name?.trim()) {
    const duplicate = await Reference.findOne({
      _id: { $ne: referenceId },
      name: name.trim(),
    }).collation({ locale: "en", strength: 2 });

    if (duplicate) {
      throw new ApiError(409, "A reference with this name already exists");
    }

    reference.name = name.trim();

    // Keep already-saved clients' denormalized referral label in sync
    // with the reference's new name.
    await Client.updateMany(
      { reference: reference._id },
      { $set: { referralSource: reference.name } },
    );
  }

  if (notes !== undefined) {
    reference.notes = notes?.trim() || undefined;
  }

  if (status && ["active", "inactive"].includes(status)) {
    reference.status = status;
  }

  await reference.save();

  return res
    .status(200)
    .json(new ApiResponse(200, reference, "Reference updated successfully"));
});

// ============================================================
// DELETE REFERENCE
// DELETE /api/v1/references/:referenceId
// ============================================================
const deleteReference = asyncHandler(async (req, res) => {
  const { referenceId } = req.params;

  const reference = await Reference.findById(referenceId);

  if (!reference) {
    throw new ApiError(404, "Reference not found");
  }

  const clientCount = await Client.countDocuments({ reference: reference._id });

  if (clientCount > 0) {
    throw new ApiError(
      409,
      `This reference is linked to ${clientCount} client${clientCount !== 1 ? "s" : ""}. Deactivate it instead of deleting, or reassign those clients first.`,
    );
  }

  await Reference.findByIdAndDelete(referenceId);

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Reference deleted successfully"));
});

export {
  createReference,
  getAllReferences,
  getReferenceById,
  updateReference,
  deleteReference,
};

import { User } from "../models/user.models.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";

const verifyJWT = asyncHandler(async (req, res, next) => {
  try {
    const token =
      req.cookies.accessToken ||
      req.header("Authorization")?.replace("Bearer", "");
    if (!token) throw new ApiError(401, "Unauthorizeddd");

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const user = await User.findById(decoded._id).select(
      "-password -refreshToken",
    );

    if (!user) throw new ApiError(401, "Invalid Access Token");
    req.user = user;
    next();
  } catch (error) {
    throw new ApiError(401, error.message || "Invalid Access Token");
  }
});

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      throw new ApiError(403, "Unauthorized");
    }
    next();
  };
};

// Allows access if the user's role is in `roles` OR their department is in
// `departments`. Use for features scoped to specific departments (in
// addition to admins/super-admins), rather than role alone.
const authorizeRolesOrDepartments = (roles = [], departments = []) => {
  return (req, res, next) => {
    const roleAllowed = roles.includes(req.user.role);
    const departmentAllowed = departments.includes(req.user.department);
    if (!roleAllowed && !departmentAllowed) {
      throw new ApiError(403, "Unauthorized");
    }
    next();
  };
};

// Gate for the invoicing / invoice-email feature: admins, super-admins, and
// the sales department only. Attach to invoice routes once they exist.
const requireInvoiceAccess = authorizeRolesOrDepartments(
  ["admin", "super-admin"],
  ["sales"],
);

export {
  verifyJWT,
  authorize,
  authorizeRolesOrDepartments,
  requireInvoiceAccess,
};

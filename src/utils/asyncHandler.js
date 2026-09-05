const asyncHandler = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (e) {
    if (e.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: `Invalid ${e.path}: ${e.value}`,
      });
    }

    if (e.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(e.errors)
          .map((err) => err.message)
          .join(", "),
      });
    }

    if (e.status) {
      return res.status(e.status).json({
        success: false,
        message: e.message || "Internal Server Error",
      });
    }

    console.error(e);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

export { asyncHandler };

const asyncHandler = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (e) {
    const statusCode = e.status || 500;
    res.status(statusCode).json({
      success: false,
      message: e.message || "Internal Server Error",
    });
  }
};

export { asyncHandler };

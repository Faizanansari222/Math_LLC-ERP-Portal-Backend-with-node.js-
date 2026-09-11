const asyncHandler = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (e) {
    const statusCode = e.status || 500;
    // Every controller error funnels through here — log it so failures
    // (e.g. a provider rejecting an email send) show up in server logs,
    // not just as a JSON response the caller may or may not be watching.
    console.error(`[${req.method} ${req.originalUrl}]`, e);
    res.status(statusCode).json({
      success: false,
      message: e.message || "Internal Server Error",
    });
  }
};

export { asyncHandler };

class ApiError extends Error {
  constructor(
    status,
    message = "somthing went wrong",
    errors = [],
    statck = "",
  ) {
    super(message);
    this.status = status;
    this.message = message;
    this.success = false;
    this.errors = errors;
    if (statck) {
      this.statck = statck;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export { ApiError };

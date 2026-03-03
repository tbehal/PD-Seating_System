class AppError extends Error {
  statusCode: number;
  details: Record<string, string> | null;

  constructor(statusCode: number, message: string, details: Record<string, string> | null = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export = AppError;

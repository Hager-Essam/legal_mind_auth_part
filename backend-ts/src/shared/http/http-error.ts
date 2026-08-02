export class HttpError extends Error {
  public readonly statusCode: number;
  public readonly details?: unknown;
  public readonly code: string;

  constructor(statusCode: number, message: string, details?: unknown, code = "HttpError") {
    super(message);
    this.name = code;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

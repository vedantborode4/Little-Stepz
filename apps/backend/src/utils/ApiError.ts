export class ApiError extends Error {
  readonly statusCode: number;
  readonly success: boolean = false;
  readonly errors: { field?: string; message: string }[];

  constructor(
    statusCode: number,
    message = "Something went wrong",
    errors: { field?: string; message: string }[] = []
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errors = errors;

    Error.captureStackTrace(this, this.constructor);
  }
}

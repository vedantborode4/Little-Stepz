import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/api";
import { ZodError } from "zod";

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) => {

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors || undefined,
    });
  }

  if (err instanceof ZodError) {
    const formattedErrors = err.flatten();
    const allErrors = {
      ...formattedErrors.fieldErrors,
      ...(formattedErrors.formErrors.length > 0 && {
        form: formattedErrors.formErrors,
      }),
    };

    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: allErrors,
    });
  }

  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON",
      errors: [err.message],
    });
  }

  res.status(500).json({
    success: false,
    message: "Internal Server Error",
  });
};

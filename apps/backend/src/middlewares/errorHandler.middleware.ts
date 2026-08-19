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

  // Anything reaching here is unexpected. It was previously discarded silently, so a
  // 500 in production left no trace at all — no message, no stack, no route. Log it
  // before answering, or these are undiagnosable after the fact.
  const e = err as any;
  console.error(
    `[error] ${req.method} ${req.originalUrl} -> 500`,
    {
      name: e?.name,
      message: e?.message,
      code: e?.code,
      meta: e?.meta,
    },
    e?.stack ?? ""
  );

  res.status(500).json({
    success: false,
    message: "Internal Server Error",
  });
};

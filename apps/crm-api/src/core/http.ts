import type { Request, Response } from "express";

/**
 * Every failure the API means to report. `code` is stable and machine-readable
 * (clients map it to copy); `message` is a sensible English default.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message?: string,
    public readonly details?: unknown,
  ) {
    super(message ?? code);
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export const notFound = (entity: string) => new ApiError(404, "NOT_FOUND", `${entity} not found`);
export const forbidden = (message = "You do not have permission to do this") => new ApiError(403, "FORBIDDEN", message);

/** Success envelope: `{ data }`. Errors use `{ error: { code, message, details } }`. */
export function sendData(res: Response, data: unknown, status = 200) {
  return res.status(status).json({ data });
}

/** Request metadata services need for auditing, decoupled from Express. */
export interface RequestContext {
  userId: string | null;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
}

export function requestContext(req: Request): RequestContext {
  return {
    userId: req.user?.id ?? null,
    ip: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
    requestId: req.id ?? null,
  };
}

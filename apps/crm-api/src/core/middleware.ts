import { randomUUID } from "crypto";
import type { NextFunction, Request, Response } from "express";
import { ZodError, z } from "zod";
import { Prisma } from "@repo/crm-db/client";
import { ApiError } from "./http";
import { logger } from "./logger";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

export function requestId(req: Request, res: Response, next: NextFunction) {
  const incoming = req.get("x-request-id");
  req.id = incoming && REQUEST_ID_PATTERN.test(incoming) ? incoming : randomUUID();
  res.setHeader("X-Request-Id", req.id);
  next();
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const started = process.hrtime.bigint();
  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    logger.info(
      { requestId: req.id, method: req.method, url: req.originalUrl, status: res.statusCode, ms: Math.round(ms), userId: req.user?.id },
      "request",
    );
  });
  next();
}

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
  next(new ApiError(404, "ROUTE_NOT_FOUND", "Route not found"));
}

function sendError(res: Response, status: number, code: string, message: string, details?: unknown) {
  return res.status(status).json({ error: { code, message, details } });
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return sendError(res, err.status, err.code, err.message, err.details);
  }

  if (err instanceof ZodError) {
    return sendError(res, 400, "VALIDATION_FAILED", "Some fields are invalid", z.flattenError(err));
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return sendError(res, 409, "ALREADY_EXISTS", "A record with these details already exists", {
        fields: err.meta?.target,
      });
    }
    if (err.code === "P2025") {
      return sendError(res, 404, "NOT_FOUND", "Record not found");
    }
  }

  if (err instanceof SyntaxError && "body" in err) {
    return sendError(res, 400, "INVALID_JSON", "Request body is not valid JSON");
  }

  // body-parser refuses an upload over the route's limit before reading it.
  if (err instanceof Error && "type" in err && err.type === "entity.too.large") {
    const limit = "limit" in err && typeof err.limit === "number" ? err.limit : null;
    const mb = limit ? ` (the limit is ${Math.round(limit / (1024 * 1024))} MB)` : "";
    return sendError(res, 413, "FILE_TOO_LARGE", `The file is too large${mb}`, { limitBytes: limit });
  }

  logger.error({ err, requestId: req.id, method: req.method, url: req.originalUrl }, "unhandled error");
  return sendError(res, 500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
}

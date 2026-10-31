import express, { Router, type Request, type Response } from "express";
import {
  idParam,
  IMPORT_MAX_BYTES,
  importListQuery,
  importMappingSchema,
  importReasonSchema,
  importRowsQuery,
  importTemplatesQuery,
  importUploadQuery,
} from "@repo/crm-schema";
import { requirePermission } from "../../core/auth";
import { ApiError, requestContext, sendData } from "../../core/http";
import * as imports from "./imports.service";

export const importsRoutes = Router();
importsRoutes.use(requirePermission("import.manage"));

// The file is the request body itself (no multipart), capped before it is read.
const fileBody = express.raw({ type: () => true, limit: IMPORT_MAX_BYTES });

importsRoutes.get("/", async (req: Request, res: Response) => {
  sendData(res, await imports.listImports(importListQuery.parse(req.query)));
});

importsRoutes.get("/templates", async (req: Request, res: Response) => {
  const { kind } = importTemplatesQuery.parse(req.query);
  sendData(res, await imports.listTemplates(kind));
});

importsRoutes.post("/", fileBody, async (req: Request, res: Response) => {
  const query = importUploadQuery.parse(req.query);
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) throw new ApiError(400, "IMPORT_FILE_INVALID", "Choose a file to upload");
  sendData(res, await imports.uploadImport(query, req.body, requestContext(req)), 201);
});

importsRoutes.get("/:id", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  sendData(res, await imports.getImport(id));
});

importsRoutes.get("/:id/rows", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  sendData(res, await imports.listImportRows(id, importRowsQuery.parse(req.query)));
});

importsRoutes.put("/:id/mapping", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  sendData(res, await imports.mapAndCheck(id, importMappingSchema.parse(req.body), requestContext(req)));
});

importsRoutes.post("/:id/approve", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  sendData(res, await imports.approveImport(id, requestContext(req)));
});

importsRoutes.post("/:id/rollback", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  const { reason } = importReasonSchema.parse(req.body);
  sendData(res, await imports.rollbackImport(id, reason, requestContext(req)));
});

importsRoutes.post("/:id/cancel", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  sendData(res, await imports.cancelImport(id, requestContext(req)));
});

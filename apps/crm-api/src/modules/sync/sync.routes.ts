import { Router, type Request, type Response } from "express";
import { idParam, linkIdsSchema, listQuery } from "@repo/crm-schema";
import { requirePermission } from "../../core/auth";
import { requestContext, sendData } from "../../core/http";
import * as sync from "./sync.service";

export const syncRoutes = Router();
syncRoutes.use(requirePermission("settings.manage"));

syncRoutes.get("/status", async (_req: Request, res: Response) => {
  sendData(res, await sync.syncStatus());
});

syncRoutes.get("/runs", async (req: Request, res: Response) => {
  sendData(res, await sync.listRuns(listQuery.parse(req.query)));
});

syncRoutes.get("/runs/:id", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  sendData(res, await sync.getRun(id));
});

syncRoutes.post("/dry-run", async (req: Request, res: Response) => {
  sendData(res, await sync.dryRun(requestContext(req)), 201);
});

syncRoutes.post("/link-ids", async (req: Request, res: Response) => {
  const { dryRunId } = linkIdsSchema.parse(req.body);
  sendData(res, await sync.linkIds(dryRunId, requestContext(req)), 201);
});

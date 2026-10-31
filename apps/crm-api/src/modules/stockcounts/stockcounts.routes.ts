import { Router, type Request, type Response } from "express";
import {
  addCountLineSchema,
  approveStockCountSchema,
  createStockCountSchema,
  idParam,
  saveCountsSchema,
  stockCountListQuery,
  stockCountReasonSchema,
} from "@repo/crm-schema";
import { can, requireAnyPermission, requirePermission } from "../../core/auth";
import { requestContext, sendData } from "../../core/http";
import * as counts from "./stockcounts.service";

const perform = requireAnyPermission("stockcount.perform", "stockcount.approve");
const approve = requirePermission("stockcount.approve");
const rights = (req: Request): counts.CountRights => ({ approve: can(req, "stockcount.approve"), costs: can(req, "costs.view") });

export const stockCountsRoutes = Router();

stockCountsRoutes.get("/", perform, async (req: Request, res: Response) => {
  sendData(res, await counts.listCounts(stockCountListQuery.parse(req.query), rights(req)));
});

stockCountsRoutes.post("/", perform, async (req: Request, res: Response) => {
  sendData(res, await counts.createCount(createStockCountSchema.parse(req.body), requestContext(req), rights(req)), 201);
});

stockCountsRoutes.get("/:id", perform, async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  sendData(res, await counts.getCount(id, rights(req)));
});

stockCountsRoutes.put("/:id/counts", perform, async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  sendData(res, await counts.saveCounts(id, saveCountsSchema.parse(req.body), requestContext(req), rights(req)));
});

stockCountsRoutes.post("/:id/lines", perform, async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  const { variantId } = addCountLineSchema.parse(req.body);
  sendData(res, await counts.addLine(id, variantId, requestContext(req), rights(req)));
});

stockCountsRoutes.post("/:id/submit", perform, async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  sendData(res, await counts.submitCount(id, requestContext(req), rights(req)));
});

stockCountsRoutes.post("/:id/cancel", perform, async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  const { reason } = stockCountReasonSchema.parse(req.body);
  sendData(res, await counts.cancelCount(id, reason, requestContext(req), rights(req)));
});

stockCountsRoutes.post("/:id/send-back", approve, async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  const { reason } = stockCountReasonSchema.parse(req.body);
  sendData(res, await counts.sendBack(id, reason, requestContext(req), rights(req)));
});

stockCountsRoutes.post("/:id/approve", approve, async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  sendData(res, await counts.approveCount(id, approveStockCountSchema.parse(req.body), requestContext(req), rights(req)));
});

stockCountsRoutes.post("/:id/reverse", approve, async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  const { reason } = stockCountReasonSchema.parse(req.body);
  sendData(res, await counts.reverseCount(id, reason, requestContext(req), rights(req)));
});

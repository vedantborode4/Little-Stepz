import { Router, type Request, type Response } from "express";
import { analyticsRangeQuery, dashboardQuery, profitBreakdownQuery, valuationQuery } from "@repo/crm-schema";
import { can, requirePermission } from "../../core/auth";
import { ApiError, sendData } from "../../core/http";
import * as analytics from "./analytics.service";

const financial = requirePermission("reports.financial", "costs.view");

function range<T extends { from: string; to: string }>(query: T): T {
  if (query.from > query.to) throw new ApiError(400, "INVALID_RANGE", "The start date is after the end date");
  return query;
}

export const analyticsRoutes = Router();

analyticsRoutes.get("/dashboard", requirePermission("dashboard.view"), async (req: Request, res: Response) => {
  const rights = { costs: can(req, "costs.view"), payments: can(req, "payments.view") };
  sendData(res, await analytics.dashboard(dashboardQuery.parse(req.query), rights));
});

analyticsRoutes.get("/profit", financial, async (req: Request, res: Response) => {
  sendData(res, await analytics.profitWaterfall(range(analyticsRangeQuery.parse(req.query))));
});

analyticsRoutes.get("/breakdown", financial, async (req: Request, res: Response) => {
  sendData(res, await analytics.profitBreakdown(range(profitBreakdownQuery.parse(req.query))));
});

analyticsRoutes.get("/valuation", financial, async (req: Request, res: Response) => {
  sendData(res, await analytics.valuation(valuationQuery.parse(req.query)));
});

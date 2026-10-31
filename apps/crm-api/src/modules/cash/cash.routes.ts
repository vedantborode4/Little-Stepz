import { Router, type Request, type Response } from "express";
import { cashDayQuery, cashSessionListQuery, closeCashDaySchema, idParam, openCashDaySchema, reopenCashDaySchema } from "@repo/crm-schema";
import { requirePermission } from "../../core/auth";
import { requestContext, sendData } from "../../core/http";
import * as cash from "./cash.service";

const close = requirePermission("cash.close");

export const cashRoutes = Router();

cashRoutes.get("/day", close, async (req: Request, res: Response) => {
  const { accountId, date } = cashDayQuery.parse(req.query);
  sendData(res, await cash.cashDay(accountId, date));
});

cashRoutes.get("/sessions", close, async (req: Request, res: Response) => {
  sendData(res, await cash.listSessions(cashSessionListQuery.parse(req.query)));
});

cashRoutes.post("/sessions", close, async (req: Request, res: Response) => {
  sendData(res, await cash.openDay(openCashDaySchema.parse(req.body), requestContext(req)), 201);
});

cashRoutes.post("/sessions/:id/close", close, async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  sendData(res, await cash.closeDay(id, closeCashDaySchema.parse(req.body), requestContext(req)));
});

cashRoutes.post("/sessions/:id/reopen", requirePermission("cash.reopen"), async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  const { reason } = reopenCashDaySchema.parse(req.body);
  sendData(res, await cash.reopenDay(id, reason, requestContext(req)));
});

import { Router, type Request, type Response } from "express";
import {
  commissionPayoutSchema,
  commissionQuery,
  createSalespersonSchema,
  idParam,
  includeInactiveQuery,
  updateSalespersonSchema,
} from "@repo/crm-schema";
import { requireAnyPermission, requirePermission } from "../../core/auth";
import { requestContext, sendData } from "../../core/http";
import * as commission from "./commission.service";
import * as salespeople from "./salespeople.service";

const manage = requirePermission("commission.manage");

export const salespeopleRoutes = Router();

/** The checkout picker: names and staff IDs only. */
salespeopleRoutes.get("/options", requireAnyPermission("sales.create", "commission.manage"), async (_req: Request, res: Response) => {
  sendData(res, await salespeople.listOptions());
});

salespeopleRoutes.get("/", manage, async (req: Request, res: Response) => {
  const { includeInactive } = includeInactiveQuery.parse(req.query);
  sendData(res, await salespeople.listSalespeople(includeInactive));
});

salespeopleRoutes.post("/", manage, async (req: Request, res: Response) => {
  sendData(res, await salespeople.createSalesperson(createSalespersonSchema.parse(req.body), requestContext(req)), 201);
});

salespeopleRoutes.patch("/:id", manage, async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  sendData(res, await salespeople.updateSalesperson(id, updateSalespersonSchema.parse(req.body), requestContext(req)));
});

export const commissionRoutes = Router();
commissionRoutes.use(manage);

commissionRoutes.get("/", async (req: Request, res: Response) => {
  sendData(res, await commission.commissionSummary(commissionQuery.parse(req.query)));
});

commissionRoutes.get("/salespeople/:id", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  sendData(res, await commission.commissionDetail(id, commissionQuery.parse(req.query)));
});

commissionRoutes.post("/payouts", async (req: Request, res: Response) => {
  sendData(res, await commission.recordPayout(commissionPayoutSchema.parse(req.body), requestContext(req)), 201);
});

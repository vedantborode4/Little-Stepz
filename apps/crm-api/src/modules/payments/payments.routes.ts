import { Router } from "express";
import { requirePermission } from "../../core/auth";
import * as controller from "./payments.controller";

const view = requirePermission("payments.view");
const record = requirePermission("payments.record");
const refund = requirePermission("payments.refund");
const transfer = requirePermission("payments.transfer");

export const paymentsRoutes = Router();

paymentsRoutes.get("/", view, controller.list);
paymentsRoutes.post("/", record, controller.receive);
paymentsRoutes.get("/collections", view, controller.collections);
paymentsRoutes.get("/outstanding", view, controller.outstanding);
paymentsRoutes.get("/outstanding/summary", view, controller.outstandingSummary);
paymentsRoutes.get("/transfers", view, controller.listTransfers);
paymentsRoutes.post("/transfers", transfer, controller.createTransfer);
paymentsRoutes.post("/transfers/:id/reverse", transfer, controller.reverseTransfer);
paymentsRoutes.get("/credit/:id", view, controller.credit);
paymentsRoutes.post("/credit/:id/apply", record, controller.applyCredit);
paymentsRoutes.post("/credit/:id/refund", refund, controller.refundCredit);
paymentsRoutes.get("/:id", view, controller.get);
paymentsRoutes.post("/:id/void", refund, controller.voidPayment);

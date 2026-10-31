import type { Request, Response } from "express";
import { createReturnSchema, idParam, REFUND_METHOD_LABELS, returnListQuery, returnPreviewSchema } from "@repo/crm-schema";
import { can } from "../../core/auth";
import { sendExport } from "../../core/export";
import { requestContext, sendData } from "../../core/http";
import * as returns from "./returns.service";

const rights = (req: Request): returns.ReturnRights => ({ refund: can(req, "payments.refund"), costs: can(req, "costs.view") });

export async function list(req: Request, res: Response) {
  const query = returnListQuery.parse(req.query);
  const result = await returns.listReturns(query);
  if (query.format) {
    return sendExport(res, {
      filename: "returns",
      format: query.format,
      rows: result.items,
      columns: [
        { header: "Return", value: (r) => r.code },
        { header: "Date", value: (r) => r.businessDate },
        { header: "Order", value: (r) => r.orderCode },
        { header: "Customer", value: (r) => (r.customer ? `${r.customer.name} (${r.customer.code})` : "Walk-in"), width: 26 },
        { header: "Units", value: (r) => r.units },
        { header: "Value (INR, incl. GST)", value: (r) => Number(r.amount) },
        { header: "Money back", value: (r) => REFUND_METHOD_LABELS[r.refundMethod] },
        { header: "Refund (INR)", value: (r) => Number(r.refundAmount) },
        { header: "Reason", value: (r) => r.reason, width: 30 },
      ],
    });
  }
  sendData(res, result);
}

export async function get(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  sendData(res, await returns.getReturn(id, can(req, "costs.view")));
}

export async function preview(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  sendData(res, await returns.previewReturn(id, returnPreviewSchema.parse(req.body), rights(req)));
}

export async function create(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  sendData(res, await returns.createReturn(id, createReturnSchema.parse(req.body), requestContext(req), rights(req)), 201);
}

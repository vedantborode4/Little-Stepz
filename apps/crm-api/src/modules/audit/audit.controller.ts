import type { Request, Response } from "express";
import { auditListQuery } from "@repo/crm-schema";
import { sendExport } from "../../core/export";
import { sendData } from "../../core/http";
import * as auditService from "./audit.service";

export async function list(req: Request, res: Response) {
  const query = auditListQuery.parse(req.query);
  const result = await auditService.listAudit(query);

  if (query.format) {
    return sendExport(res, {
      filename: "audit-history",
      format: query.format,
      rows: result.items,
      columns: [
        { header: "When (UTC)", value: (r) => r.createdAt, width: 24 },
        { header: "User", value: (r) => r.userName ?? "System", width: 20 },
        { header: "Action", value: (r) => r.action, width: 28 },
        { header: "Entity", value: (r) => r.entity, width: 18 },
        { header: "Entity ID", value: (r) => r.entityId, width: 38 },
        { header: "Before", value: (r) => (r.before ? JSON.stringify(r.before) : ""), width: 50 },
        { header: "After", value: (r) => (r.after ? JSON.stringify(r.after) : ""), width: 50 },
      ],
    });
  }
  sendData(res, result);
}

import { Router, type Request, type Response } from "express";
import { reportKeyParam, reportQuery } from "@repo/crm-schema";
import { can, requirePermission } from "../../core/auth";
import { sendExport } from "../../core/export";
import { sendData } from "../../core/http";
import * as reports from "./reports.service";

const allowed =
  (req: Request): reports.Allowed =>
  (permission) =>
    can(req, permission);

export const reportsRoutes = Router();
reportsRoutes.use(requirePermission("reports.view"));

reportsRoutes.get("/", (req: Request, res: Response) => {
  sendData(res, reports.listReports(allowed(req)));
});

reportsRoutes.get("/:key", async (req: Request, res: Response) => {
  const { key } = reportKeyParam.parse(req.params);
  const query = reportQuery.parse(req.query);
  if (!query.format) return sendData(res, await reports.previewReport(key, query, allowed(req)));

  const { columns, rows } = await reports.runReport(key, query, allowed(req));
  await sendExport(res, {
    filename: key,
    format: query.format,
    columns: columns.map((header) => ({ header, value: (row: (typeof rows)[number]) => row[header] })),
    rows,
  });
});

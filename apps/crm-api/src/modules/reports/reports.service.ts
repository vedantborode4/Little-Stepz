import type { Permission, ReportDefinitionDto, ReportKey, ReportPreviewDto, ReportQuery } from "@repo/crm-schema";
import { ApiError, forbidden, notFound } from "../../core/http";
import { REPORT_GROUPS, REPORTS, type ReportContext, type ReportSpec } from "./reports.registry";

const PREVIEW_ROWS = 200;

/** True when the caller holds a permission. Passed in so the service stays free of Express. */
export type Allowed = (permission: Permission) => boolean;

const visible = (spec: ReportSpec, allowed: Allowed) => spec.permissions.every(allowed);

export function listReports(allowed: Allowed): ReportDefinitionDto[] {
  return REPORTS.filter((spec) => visible(spec, allowed))
    .sort((a, b) => REPORT_GROUPS.indexOf(a.group) - REPORT_GROUPS.indexOf(b.group))
    .map(({ key, title, description, group, filters }) => ({ key, title, description, group, filters }));
}

function findReport(key: string, allowed: Allowed): ReportSpec {
  const spec = REPORTS.find((r) => r.key === key);
  if (!spec) throw notFound("Report");
  if (!visible(spec, allowed)) throw forbidden("You do not have access to this report");
  return spec;
}

/** Runs a report and returns its rows with their headers (taken from the first row, or none when empty). */
export async function runReport(key: ReportKey, query: ReportQuery, allowed: Allowed) {
  const spec = findReport(key, allowed);
  if (query.from && query.to && query.from > query.to) throw new ApiError(400, "INVALID_RANGE", "The start date is after the end date");
  const ctx: ReportContext = { costs: allowed("costs.view") };
  const rows = await spec.load(query, ctx);
  const columns = rows.length > 0 ? Object.keys(rows[0]!) : [];
  return { spec, columns, rows };
}

export async function previewReport(key: ReportKey, query: ReportQuery, allowed: Allowed): Promise<ReportPreviewDto> {
  const { spec, columns, rows } = await runReport(key, query, allowed);
  return {
    key: spec.key,
    title: spec.title,
    columns,
    rows: rows.slice(0, PREVIEW_ROWS).map((row) => columns.map((c) => row[c] ?? null)),
    total: rows.length,
    truncated: rows.length > PREVIEW_ROWS,
  };
}

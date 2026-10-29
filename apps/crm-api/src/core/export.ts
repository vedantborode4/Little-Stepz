import type { Response } from "express";
import ExcelJS from "exceljs";
import type { ExportFormat } from "@repo/crm-schema";

export interface ExportColumn<T> {
  header: string;
  value: (row: T) => string | number | boolean | null | undefined;
  width?: number;
}

interface ExportOptions<T> {
  filename: string;
  format: ExportFormat;
  columns: ExportColumn<T>[];
  rows: T[];
}

/**
 * Spreadsheet apps execute cells that start with = + - @ (CSV injection). Text
 * cells starting with those are prefixed with an apostrophe; real numbers are
 * passed as numbers and are unaffected.
 */
function neutraliseFormula(value: string) {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "string" ? neutraliseFormula(value) : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function sendExport<T>(res: Response, { filename, format, columns, rows }: ExportOptions<T>) {
  const stamp = new Date().toISOString().slice(0, 10);
  const base = `${filename}-${stamp}`;

  if (format === "csv") {
    const lines = [
      columns.map((c) => csvCell(c.header)).join(","),
      ...rows.map((row) => columns.map((c) => csvCell(c.value(row))).join(",")),
    ];
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${base}.csv"`);
    // BOM so Excel opens UTF-8 (₹, names in Indian scripts) correctly.
    return res.send(`﻿${lines.join("\r\n")}`);
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(filename.slice(0, 31));
  sheet.columns = columns.map((c) => ({ header: c.header, width: c.width ?? Math.max(12, c.header.length + 2) }));
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  for (const row of rows) {
    sheet.addRow(
      columns.map((c) => {
        const v = c.value(row);
        return typeof v === "string" ? neutraliseFormula(v) : (v ?? null);
      }),
    );
  }

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${base}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
}

import ExcelJS from "exceljs";
import Papa from "papaparse";
import { IMPORT_MAX_ROWS } from "@repo/crm-schema";
import { ApiError } from "../../core/http";

export interface ParsedFile {
  headers: string[];
  /** Non-empty data rows keyed by header (values trimmed), with their line number in the file. */
  rows: { line: number; values: Record<string, string> }[];
}

const MAX_COLUMNS = 60;

const badFile = (message: string) => new ApiError(400, "IMPORT_FILE_INVALID", message);

/** Excel cells can be numbers, dates, rich text or formulas; the import only ever sees their displayed text. */
function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("result" in v) return String(v.result ?? "");
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("text" in v) return String(v.text);
    return cell.text;
  }
  return String(v);
}

async function readXlsx(buffer: Buffer): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw badFile("This doesn't look like an Excel (.xlsx) file");
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw badFile("The workbook has no sheets");
  const out: string[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row) => {
    const cells: string[] = [];
    for (let c = 1; c <= Math.min(row.cellCount, MAX_COLUMNS); c++) cells.push(cellText(row.getCell(c)));
    out.push(cells);
  });
  return out;
}

function readCsv(buffer: Buffer): string[][] {
  const text = buffer.toString("utf8").replace(/^﻿/, "");
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: false });
  if (parsed.errors.some((e) => e.type === "Quotes"))
    throw badFile(`The CSV has an unclosed quote near row ${parsed.errors[0]!.row ?? "?"}`);
  return parsed.data;
}

/**
 * Reads the first sheet of an .xlsx or a .csv into header-keyed rows. The first
 * non-empty row is the header; blank and duplicate headers are refused so every
 * mapped column is unambiguous.
 */
export async function parseImportFile(buffer: Buffer, fileName: string): Promise<ParsedFile> {
  const lower = fileName.toLowerCase();
  let grid: string[][];
  if (lower.endsWith(".xlsx")) grid = await readXlsx(buffer);
  else if (lower.endsWith(".csv")) grid = readCsv(buffer);
  else throw badFile("Upload a .csv or .xlsx file");

  const [headerRow, ...body] = grid.map((r) => r.map((c) => String(c ?? "").trim()));
  if (!headerRow?.some(Boolean)) throw badFile("The file is empty");
  if (headerRow.length > MAX_COLUMNS) throw badFile(`At most ${MAX_COLUMNS} columns`);

  const lastFilled = headerRow.reduce((last, h, i) => (h ? i : last), -1);
  const headers = headerRow.slice(0, lastFilled + 1);
  const blank = headers.findIndex((h) => !h);
  if (blank >= 0) throw badFile(`Column ${blank + 1} has no header`);
  const seen = new Set<string>();
  for (const h of headers) {
    if (seen.has(h.toLowerCase())) throw badFile(`The header "${h}" appears twice`);
    seen.add(h.toLowerCase());
  }

  const rows = body
    .map((r, i) => ({ line: i + 2, values: Object.fromEntries(headers.map((h, c) => [h, r[c] ?? ""])) }))
    .filter((r) => Object.values(r.values).some(Boolean));
  if (rows.length === 0) throw badFile("The file has a header but no rows");
  if (rows.length > IMPORT_MAX_ROWS)
    throw badFile(`At most ${IMPORT_MAX_ROWS.toLocaleString("en-IN")} rows per file; split it into smaller files`);
  return { headers, rows };
}

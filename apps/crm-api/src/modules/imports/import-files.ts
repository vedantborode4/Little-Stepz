import ExcelJS from "exceljs";
import Papa from "papaparse";
import { IMPORT_MAX_ROWS } from "@repo/crm-schema";
import { ApiError } from "../../core/http";

export interface ParsedFile {
  headers: string[];
  /** Non-empty data rows keyed by header (values trimmed), with their row number in the file or sheet. */
  rows: { line: number; values: Record<string, string> }[];
  sheetName: string | null;
  headerRow: number;
}

export interface ParseOptions {
  sheet?: string;
  headerRow?: number;
}

interface GridRow {
  number: number;
  cells: string[];
}

const MAX_COLUMNS = 100;
/** Title and instruction rows above the headings are skipped; the headings are looked for this far down. */
const HEADER_SEARCH_ROWS = 30;

const badFile = (message: string) => new ApiError(400, "IMPORT_FILE_INVALID", message);

/**
 * Excel cells can be numbers, dates, rich text or formulas; the import only
 * ever sees their value. A merged range keeps its text in its first cell, so
 * the copies Excel reports for the other cells are blanked.
 */
function cellText(cell: ExcelJS.Cell): string {
  if (cell.isMerged && cell.master.address !== cell.address) return "";
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("formula" in v || "sharedFormula" in v) {
      const r = v.result;
      if (r === null || r === undefined || (typeof r === "object" && !(r instanceof Date))) return "";
      return r instanceof Date ? r.toISOString().slice(0, 10) : String(r);
    }
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("text" in v) return String(v.text);
    if ("error" in v) return "";
    return cell.text;
  }
  return String(v);
}

async function readXlsx(buffer: Buffer, wanted: string | undefined): Promise<{ sheetName: string; grid: GridRow[] }> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw badFile("This doesn't look like an Excel (.xlsx) file");
  }
  const visible = workbook.worksheets.filter((s) => s.state === "visible");
  if (visible.length === 0) throw badFile("The workbook has no sheets");
  let sheet = visible[0]!;
  if (wanted) {
    const match = workbook.worksheets.find((s) => s.name.trim().toLowerCase() === wanted.toLowerCase());
    if (!match) throw badFile(`The workbook has no sheet named "${wanted}"`);
    sheet = match;
  } else if (visible.length > 1) {
    throw new ApiError(400, "IMPORT_PICK_SHEET", `This workbook has ${visible.length} sheets; choose the one to import`, {
      sheets: visible.map((s) => s.name),
    });
  }

  const grid: GridRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    for (let c = 1; c <= Math.min(row.cellCount, MAX_COLUMNS); c++) cells.push(cellText(row.getCell(c)));
    grid.push({ number: row.number, cells });
  });
  return { sheetName: sheet.name, grid };
}

function readCsv(buffer: Buffer): GridRow[] {
  const text = buffer.toString("utf8").replace(/^﻿/, "");
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: false });
  if (parsed.errors.some((e) => e.type === "Quotes"))
    throw badFile(`The CSV has an unclosed quote near row ${parsed.errors[0]!.row ?? "?"}`);
  return parsed.data.map((cells, i) => ({ number: i + 1, cells }));
}

const filled = (cells: string[]) => cells.filter(Boolean).length;

/**
 * The first row near the top that is nearly as full as the fullest one. Titles,
 * notes and group labels above the headings fill only a few cells; a data row
 * with an extra filled cell must not win over the headings above it.
 */
function findHeaderRow(grid: GridRow[]): GridRow | undefined {
  const candidates = grid.filter((r) => filled(r.cells) > 0).slice(0, HEADER_SEARCH_ROWS);
  const widest = Math.max(0, ...candidates.map((r) => filled(r.cells)));
  return candidates.find((r) => filled(r.cells) >= Math.max(Math.min(2, widest), Math.ceil(widest * 0.6)));
}

/**
 * Reads one sheet of an .xlsx (or a .csv) into header-keyed rows. The headings
 * row is the one given, or found automatically under any title rows. Columns
 * without a heading are ignored; a repeated heading gets a "(2)" suffix so every
 * column can still be mapped on its own.
 */
export async function parseImportFile(buffer: Buffer, fileName: string, options: ParseOptions = {}): Promise<ParsedFile> {
  const lower = fileName.toLowerCase();
  let grid: GridRow[];
  let sheetName: string | null = null;
  if (lower.endsWith(".xlsx")) ({ sheetName, grid } = await readXlsx(buffer, options.sheet));
  else if (lower.endsWith(".csv")) grid = readCsv(buffer);
  else throw badFile("Upload a .csv or .xlsx file");

  grid = grid.map((r) => ({ number: r.number, cells: r.cells.map((c) => String(c ?? "").trim()) }));
  const header = options.headerRow ? grid.find((r) => r.number === options.headerRow) : findHeaderRow(grid);
  if (!header || filled(header.cells) === 0) {
    throw badFile(options.headerRow ? `Row ${options.headerRow} is empty; choose the row with the column headings` : "The file is empty");
  }
  if (filled(header.cells) > MAX_COLUMNS) throw badFile(`At most ${MAX_COLUMNS} columns`);

  const seen = new Map<string, number>();
  const columns = header.cells.flatMap((h, index) => {
    if (!h) return [];
    const count = (seen.get(h.toLowerCase()) ?? 0) + 1;
    seen.set(h.toLowerCase(), count);
    return [{ index, name: count > 1 ? `${h} (${count})` : h }];
  });

  const rows = grid
    .filter((r) => r.number > header.number)
    .map((r) => ({ line: r.number, values: Object.fromEntries(columns.map((c) => [c.name, r.cells[c.index] ?? ""])) }))
    .filter((r) => Object.values(r.values).some(Boolean));
  if (rows.length === 0) throw badFile(`The headings are on row ${header.number}, but there are no rows under them`);
  if (rows.length > IMPORT_MAX_ROWS)
    throw badFile(`At most ${IMPORT_MAX_ROWS.toLocaleString("en-IN")} rows per file; split it into smaller files`);
  return { headers: columns.map((c) => c.name), rows, sheetName, headerRow: header.number };
}

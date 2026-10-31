import { prisma, type Tx } from "@repo/crm-db/client";
import { IMPORT_FIELDS, type ImportKind } from "@repo/crm-schema";
import type { z } from "zod";
import type { RequestContext } from "../../core/http";
import { Decimal } from "../../core/money";

export type Db = Tx | typeof prisma;

/** A data row with its values re-keyed by target field (unmapped fields absent). */
export interface FieldRow {
  line: number;
  fields: Record<string, string>;
}

export interface RowResult {
  status: "VALID" | "ERROR" | "DUPLICATE";
  errors: string[];
  duplicateOf: string | null;
}

/** Rows that are created together (a product and its variants, one customer, one bill, all opening stock). */
export interface Unit<P> {
  rows: number[];
  payload: P;
}

export interface CheckOutcome<P = unknown> {
  results: RowResult[];
  units: Unit<P>[];
  /** Plain-language lines on what approving will create, shown before approval. */
  summary?: string[];
}

export interface Created {
  /** Row index → entity it created. */
  entities: Map<number, { entity: string; id: string }>;
  stockDocumentId?: string;
}

export interface BatchRef {
  id: string;
  code: string;
  locationId: string | null;
  stockDocumentId: string | null;
  /** Choices made while mapping (see IMPORT_OPTIONS). */
  options: Record<string, string | null>;
}

export interface CreatedRow {
  createdEntity: string | null;
  createdEntityId: string | null;
}

export interface KindHandler<P> {
  check(rows: FieldRow[], batch: BatchRef): Promise<CheckOutcome<P>>;
  create(tx: Tx, ctx: RequestContext, batch: BatchRef, units: Unit<P>[]): Promise<Created>;
  /**
   * Locks the rows any new use of the batch's records must touch, so nothing
   * can start using them between the rollback's blocker check and the rollback.
   */
  lockForRollback(tx: Tx, batch: BatchRef, rows: CreatedRow[]): Promise<void>;
  /** Why the batch can't be undone any more, or null when it can. */
  rollbackBlocker(db: Db, batch: BatchRef, rows: CreatedRow[]): Promise<string | null>;
  rollback(tx: Tx, ctx: RequestContext, batch: BatchRef, rows: CreatedRow[], reason: string): Promise<void>;
}

// ─── Row outcomes ────────────────────────────────────────────────────────────

export const ok = (): RowResult => ({ status: "VALID", errors: [], duplicateOf: null });
export const fail = (r: RowResult, message: string) => {
  r.status = "ERROR";
  r.errors.push(message);
};
export const duplicate = (r: RowResult, of: string) => {
  if (r.status === "VALID") r.status = "DUPLICATE";
  r.duplicateOf = of;
};

export const labelOf = (kind: ImportKind, key: string) => IMPORT_FIELDS[kind].find((f) => f.key === key)?.label ?? key;

export function issueMessages(kind: ImportKind, error: z.ZodError, fieldFor: (path: PropertyKey[]) => string | null) {
  return error.issues.map((i) => {
    const key = fieldFor(i.path);
    return key ? `${labelOf(kind, key)}: ${i.message}` : i.message;
  });
}

// ─── Cell readers ────────────────────────────────────────────────────────────

/** "₹1,250.00", "Rs 1250" and "1 250" all mean 1250; anything else is left for the schema to reject. */
export const moneyCell = (v: string | undefined) => (v ?? "").replace(/₹|rs\.?|inr/gi, "").replace(/[,\s]/g, "");
export const numberCell = (v: string | undefined) => (v ?? "").replace(/[,\s]/g, "");
/** "18%", "18.00" and "18" are the same GST rate. */
export const gstCell = (v: string | undefined) =>
  numberCell(v)
    .replace(/%$/, "")
    .replace(/^\d+(\.\d+)?$/, (m) => String(Number(m)));
export const blankToUndefined = (v: string | undefined) => (v === undefined || v.trim() === "" ? undefined : v.trim());

/** "₹5,81,475.00": amounts in summaries, grouped the Indian way. Display only. */
export const inr = (v: Decimal | string) =>
  `₹${Number(v.toString()).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const MONEY = /^\d{1,12}(\.\d{1,2})?$/;

/** A rupee amount of at most 2 decimals, or null when blank; `false` when it isn't one. */
export function amountCell(v: string | undefined): string | null | false {
  const text = moneyCell(v);
  if (!text) return null;
  return MONEY.test(text) ? text : false;
}

/**
 * A unit cost. Spreadsheets carry costs worked out to many decimals
 * (1016.6772451483822); they are kept to the 6 places the ledger stores.
 */
export function costCell(v: string | undefined): string | null | false {
  const text = moneyCell(v);
  if (!text) return null;
  if (!/^\d{1,12}(\.\d+)?$/.test(text)) return false;
  return new Decimal(text).toDecimalPlaces(6, Decimal.ROUND_HALF_EVEN).toString();
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/**
 * A calendar date as YYYY-MM-DD. Accepts what owners type and what Excel
 * exports: 2026-09-24, 24-09-2026, 24/09/2026, 24.09.26 and 24-Sep-2026.
 */
export function dateCell(v: string | undefined): string | null | false {
  const text = (v ?? "").trim();
  if (!text) return null;
  let y: number, m: number, d: number;
  let match: RegExpMatchArray | null;
  if ((match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/))) [y, m, d] = [+match[1]!, +match[2]!, +match[3]!];
  else if ((match = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/))) [d, m, y] = [+match[1]!, +match[2]!, +match[3]!];
  else if ((match = text.match(/^(\d{1,2})[-\s]([A-Za-z]{3})[A-Za-z]*[-\s,]+(\d{2}|\d{4})$/))) {
    [d, m, y] = [+match[1]!, MONTHS.indexOf(match[2]!.toLowerCase()) + 1, +match[3]!];
  } else return false;
  if (y < 100) y += 2000;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (m < 1 || date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return false;
  return date.toISOString().slice(0, 10);
}

// ─── Lookups ─────────────────────────────────────────────────────────────────

const METHOD_WORDS: Record<string, string> = {
  cash: "CASH",
  upi: "UPI",
  bank: "BANK",
  "bank transfer": "BANK",
  neft: "BANK",
  imps: "BANK",
  gateway: "GATEWAY",
  card: "GATEWAY",
};

export interface AccountRef {
  id: string;
  name: string;
  method: string;
}

/**
 * Finds a receiving account from what a sheet says ("Cash", "PhonePe —
 * Business", "Bank Transfer"): the exact name, else the one account whose name
 * contains it, else the one account of that method. Ambiguous text is refused
 * with the choices, never guessed.
 */
export function matchAccount(accounts: AccountRef[], text: string): { account: AccountRef } | { error: string } {
  const wanted = text.trim().toLowerCase();
  const exact = accounts.filter((a) => a.name.toLowerCase() === wanted);
  if (exact.length === 1) return { account: exact[0]! };
  const partial = accounts.filter((a) => a.name.toLowerCase().includes(wanted));
  if (partial.length === 1) return { account: partial[0]! };
  const method = METHOD_WORDS[wanted];
  const byMethod = method ? accounts.filter((a) => a.method === method) : [];
  if (partial.length === 0 && byMethod.length === 1) return { account: byMethod[0]! };
  const choices = partial.length > 1 ? partial : byMethod;
  return choices.length > 1
    ? { error: `"${text}" could be ${choices.map((a) => a.name).join(" or ")}; use the account's full name` }
    : { error: `No account matches "${text}"; use one of: ${accounts.map((a) => a.name).join(", ")}` };
}

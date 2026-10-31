import { prisma, Prisma } from "@repo/crm-db/client";
import {
  IMPORT_FIELDS,
  IMPORT_KINDS_WITH_LOCATION,
  IMPORT_OPTIONS,
  type ImportBatchDto,
  type ImportBatchListItemDto,
  type ImportKind,
  type ImportListQuery,
  type ImportMappingInput,
  type ImportRowDto,
  type ImportRowsQuery,
  type ImportTemplateDto,
  type ImportUploadQuery,
} from "@repo/crm-schema";
import { recordAudit } from "../../core/audit";
import { withTransaction } from "../../core/db";
import { ApiError, notFound, type RequestContext } from "../../core/http";
import { pageWindow, paginated } from "../../core/list";
import { nextCode } from "../../core/sequence";
import { parseImportFile } from "./import-files";
import { IMPORT_HANDLERS, type BatchRef, type FieldRow, type RowResult } from "./import-kinds";

type Mapping = Record<string, string | null>;
type Options = Record<string, string | null>;

/** Approving a full file creates up to thousands of records in one transaction. */
const APPROVE_TIMEOUT_MS = 120_000;

const batchInclude = {
  location: { select: { name: true } },
  createdBy: { select: { name: true } },
  approvedBy: { select: { name: true } },
  rolledBackBy: { select: { name: true } },
} satisfies Prisma.ImportBatchInclude;
type BatchRow = Prisma.ImportBatchGetPayload<{ include: typeof batchInclude }>;

const asMapping = (v: Prisma.JsonValue | null): Mapping | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Mapping) : null);
const asStrings = (v: Prisma.JsonValue | null): string[] => (Array.isArray(v) ? v.map(String) : []);
const asOptions = (v: Prisma.JsonValue | null): Options => asMapping(v) ?? {};
const asValues = (v: Prisma.JsonValue): Record<string, string> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, string>) : {};

function toListItem(b: BatchRow): ImportBatchListItemDto {
  return {
    id: b.id,
    code: b.code,
    kind: b.kind,
    status: b.status,
    fileName: b.fileName,
    sheetName: b.sheetName,
    totalRows: b.totalRows,
    validRows: b.validRows,
    errorRows: b.errorRows,
    duplicateRows: b.duplicateRows,
    importedRows: b.importedRows,
    locationName: b.location?.name ?? null,
    createdAt: b.createdAt.toISOString(),
    createdByName: b.createdBy?.name ?? null,
    approvedAt: b.approvedAt?.toISOString() ?? null,
    rolledBackAt: b.rolledBackAt?.toISOString() ?? null,
  };
}

const ref = (b: {
  id: string;
  code: string;
  locationId: string | null;
  stockDocumentId: string | null;
  options: Prisma.JsonValue | null;
}): BatchRef => ({
  id: b.id,
  code: b.code,
  locationId: b.locationId,
  stockDocumentId: b.stockDocumentId,
  options: asOptions(b.options),
});

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Saved mapping, else the newest template of this kind, else header names matched against each field's label and aliases. */
async function suggestMapping(kind: ImportKind, headers: string[]): Promise<Mapping> {
  const template = await prisma.importTemplate.findFirst({ where: { kind }, orderBy: { updatedAt: "desc" } });
  const fromTemplate = asMapping(template?.mapping ?? null) ?? {};
  const byName = new Map(headers.map((h) => [normalise(h), h]));
  const used = new Set<string>();
  const out: Mapping = {};
  for (const f of IMPORT_FIELDS[kind]) {
    const saved = fromTemplate[f.key];
    const guess = [f.key, f.label, ...f.aliases].map((n) => byName.get(normalise(n))).find((h) => h && !used.has(h));
    const header = saved && headers.includes(saved) && !used.has(saved) ? saved : (guess ?? null);
    if (header) used.add(header);
    out[f.key] = header;
  }
  return out;
}

async function loadBatch(id: string) {
  const batch = await prisma.importBatch.findUnique({ where: { id }, include: batchInclude });
  if (!batch) throw notFound("Import");
  return batch;
}

async function createdRows(batchId: string) {
  return prisma.importRow.findMany({
    where: { batchId, status: "IMPORTED" },
    select: { createdEntity: true, createdEntityId: true },
  });
}

export async function getImport(id: string): Promise<ImportBatchDto> {
  const b = await loadBatch(id);
  const headers = asStrings(b.headers);
  const [sampleRows, suggested, blocker] = await Promise.all([
    prisma.importRow.findMany({ where: { batchId: id }, orderBy: { rowNumber: "asc" }, take: 5, select: { raw: true } }),
    asMapping(b.mapping) ? Promise.resolve(asMapping(b.mapping)!) : suggestMapping(b.kind, headers),
    b.status === "IMPORTED" ? IMPORT_HANDLERS[b.kind].rollbackBlocker(prisma, ref(b), await createdRows(id)) : Promise.resolve(null),
  ]);
  return {
    ...toListItem(b),
    headers,
    headerRow: b.headerRow,
    mapping: asMapping(b.mapping),
    suggestedMapping: suggested,
    locationId: b.locationId,
    options: asOptions(b.options),
    summary: asStrings(b.summary),
    sample: sampleRows.map((r) => asValues(r.raw)),
    approvedByName: b.approvedBy?.name ?? null,
    rolledBackByName: b.rolledBackBy?.name ?? null,
    rollbackReason: b.rollbackReason,
    stockDocumentId: b.stockDocumentId,
    rollbackBlocker: blocker,
  };
}

export async function listImports(query: ImportListQuery) {
  const where: Prisma.ImportBatchWhereInput = {
    kind: query.kind,
    status: query.status,
    ...(query.q && {
      OR: [{ code: { contains: query.q, mode: "insensitive" } }, { fileName: { contains: query.q, mode: "insensitive" } }],
    }),
  };
  const [rows, total] = await Promise.all([
    prisma.importBatch.findMany({ where, include: batchInclude, orderBy: { createdAt: "desc" }, ...pageWindow(query) }),
    prisma.importBatch.count({ where }),
  ]);
  return paginated(rows.map(toListItem), total, query);
}

export async function listImportRows(batchId: string, query: ImportRowsQuery) {
  await loadBatch(batchId);
  const where: Prisma.ImportRowWhereInput = { batchId, status: query.status };
  const [rows, total] = await Promise.all([
    prisma.importRow.findMany({ where, orderBy: { rowNumber: "asc" }, ...pageWindow(query) }),
    prisma.importRow.count({ where }),
  ]);
  const items: ImportRowDto[] = rows.map((r) => ({
    id: r.id,
    rowNumber: r.rowNumber,
    status: r.status,
    values: asValues(r.raw),
    errors: asStrings(r.errors),
    duplicateOf: r.duplicateOf,
    createdEntity: r.createdEntity,
    createdEntityId: r.createdEntityId,
  }));
  return paginated(items, total, query);
}

export async function listTemplates(kind: ImportKind): Promise<ImportTemplateDto[]> {
  const rows = await prisma.importTemplate.findMany({ where: { kind }, orderBy: { name: "asc" } });
  return rows.map((t) => ({ id: t.id, name: t.name, kind: t.kind, mapping: asMapping(t.mapping) ?? {} }));
}

/** Reads the file, keeps every non-empty row as uploaded, and suggests a column mapping. */
export async function uploadImport(input: ImportUploadQuery, file: Buffer, ctx: RequestContext) {
  const { kind, fileName } = input;
  const parsed = await parseImportFile(file, fileName, { sheet: input.sheet, headerRow: input.headerRow });
  const id = await withTransaction(async (tx) => {
    const batch = await tx.importBatch.create({
      data: {
        code: await nextCode(tx, "IMP"),
        kind,
        fileName,
        sheetName: parsed.sheetName,
        headerRow: parsed.headerRow,
        headers: parsed.headers,
        totalRows: parsed.rows.length,
        createdById: ctx.userId,
      },
    });
    await tx.importRow.createMany({ data: parsed.rows.map((r) => ({ batchId: batch.id, rowNumber: r.line, raw: r.values })) });
    await recordAudit(tx, ctx, {
      action: "import.uploaded",
      entity: "ImportBatch",
      entityId: batch.id,
      after: { code: batch.code, kind, fileName, sheet: parsed.sheetName, headerRow: parsed.headerRow, rows: parsed.rows.length },
    });
    return batch.id;
  });
  return getImport(id);
}

function assertMapping(kind: ImportKind, headers: string[], mapping: Mapping) {
  const known = new Set(IMPORT_FIELDS[kind].map((f) => f.key));
  const fieldErrors: Record<string, string[]> = {};
  const used = new Map<string, string>();
  for (const [key, header] of Object.entries(mapping)) {
    if (!known.has(key)) fieldErrors[key] = ["Not a field of this import"];
    else if (header && !headers.includes(header)) fieldErrors[key] = [`The file has no column "${header}"`];
    else if (header && used.has(header)) fieldErrors[key] = [`"${header}" is already used for another field`];
    if (header) used.set(header, key);
  }
  for (const f of IMPORT_FIELDS[kind]) if (f.required && !mapping[f.key]) fieldErrors[f.key] = ["Choose the column for this field"];
  if (Object.keys(fieldErrors).length) throw new ApiError(400, "VALIDATION_ERROR", "Check the column mapping", { fieldErrors });
}

const invalidChoice = (key: string, message: string) =>
  new ApiError(400, "VALIDATION_ERROR", message, { fieldErrors: { [`options.${key}`]: [message] } });

/** Each option is needed only when the column it describes is mapped, and must name an active record. */
async function resolveOptions(kind: ImportKind, mapping: Mapping, input: Options): Promise<Options> {
  const out: Options = {};
  for (const option of IMPORT_OPTIONS[kind]) {
    if (!mapping[option.whenMapped]) continue;
    const id = input[option.key];
    if (!id) throw invalidChoice(option.key, `${option.label}: choose one`);
    const found =
      option.type === "account"
        ? await prisma.receivingAccount.findFirst({ where: { id, isActive: true }, select: { id: true } })
        : await prisma.expenseCategory.findFirst({ where: { id, isActive: true }, select: { id: true } });
    if (!found) throw invalidChoice(option.key, `${option.label}: choose an active one`);
    out[option.key] = id;
  }
  return out;
}

async function fieldRows(batchId: string, mapping: Mapping) {
  const rows = await prisma.importRow.findMany({
    where: { batchId },
    orderBy: { rowNumber: "asc" },
    select: { id: true, rowNumber: true, raw: true },
  });
  const fields: FieldRow[] = rows.map((r) => {
    const raw = asValues(r.raw);
    return {
      line: r.rowNumber,
      fields: Object.fromEntries(Object.entries(mapping).flatMap(([key, header]) => (header ? [[key, raw[header] ?? ""]] : []))),
    };
  });
  return { ids: rows.map((r) => r.id), fields };
}

/** One UPDATE for every row's outcome, so checking 5,000 rows is a single round trip. */
async function saveRowResults(db: Prisma.TransactionClient, ids: string[], fields: FieldRow[], results: RowResult[]) {
  const payload = ids.map((id, i) => ({
    id,
    status: results[i]!.status,
    errors: results[i]!.errors,
    duplicateOf: results[i]!.duplicateOf,
    mapped: fields[i]!.fields,
  }));
  await db.$executeRaw`
    UPDATE "ImportRow" r
    SET status = v.status::"ImportRowStatus", errors = v.errors, "duplicateOf" = v."duplicateOf", mapped = v.mapped
    FROM jsonb_to_recordset(${JSON.stringify(payload)}::jsonb) AS v(id text, status text, errors jsonb, "duplicateOf" text, mapped jsonb)
    WHERE r.id = v.id`;
}

const counts = (results: RowResult[]) => ({
  validRows: results.filter((r) => r.status === "VALID").length,
  errorRows: results.filter((r) => r.status === "ERROR").length,
  duplicateRows: results.filter((r) => r.status === "DUPLICATE").length,
});

/** Saves the mapping (and optionally a template), then checks every row: errors, duplicates and unknown SKUs. */
export async function mapAndCheck(id: string, input: ImportMappingInput, ctx: RequestContext) {
  const batch = await loadBatch(id);
  if (batch.status !== "UPLOADED" && batch.status !== "VALIDATED") {
    throw new ApiError(409, "IMPORT_CLOSED", `${batch.code} is ${batch.status.toLowerCase().replace("_", " ")}`);
  }
  const mapping: Mapping = Object.fromEntries(Object.entries(input.mapping).map(([k, v]) => [k, v || null]));
  assertMapping(batch.kind, asStrings(batch.headers), mapping);

  let locationId: string | null = null;
  if (IMPORT_KINDS_WITH_LOCATION.includes(batch.kind)) {
    if (!input.locationId)
      throw new ApiError(400, "VALIDATION_ERROR", "Choose the stock location", { fieldErrors: { locationId: ["Required"] } });
    const location = await prisma.location.findFirst({ where: { id: input.locationId, isActive: true } });
    if (!location)
      throw new ApiError(400, "VALIDATION_ERROR", "Choose an active location", { fieldErrors: { locationId: ["Not active"] } });
    locationId = location.id;
  }

  const options = await resolveOptions(batch.kind, mapping, input.options);

  const { ids, fields } = await fieldRows(id, mapping);
  const { results, summary } = await IMPORT_HANDLERS[batch.kind].check(fields, { ...ref(batch), locationId, options });

  await withTransaction(
    async (tx) => {
      await saveRowResults(tx, ids, fields, results);
      await tx.importBatch.update({
        where: { id },
        data: { status: "VALIDATED", mapping, locationId, options, summary: summary ?? [], ...counts(results) },
      });
      if (input.saveTemplateAs) {
        await tx.importTemplate.upsert({
          where: { kind_name: { kind: batch.kind, name: input.saveTemplateAs } },
          create: { kind: batch.kind, name: input.saveTemplateAs, mapping, createdById: ctx.userId },
          update: { mapping },
        });
      }
      await recordAudit(tx, ctx, {
        action: "import.checked",
        entity: "ImportBatch",
        entityId: id,
        after: { mapping, locationId, options, ...counts(results) },
      });
    },
    { timeout: APPROVE_TIMEOUT_MS },
  );
  return getImport(id);
}

/**
 * Creates everything the checked rows describe, in one transaction. Rows are
 * checked again first: if anything changed since (a SKU or mobile added
 * elsewhere), nothing is imported and the owner re-checks.
 */
export async function approveImport(id: string, ctx: RequestContext) {
  const batch = await loadBatch(id);
  if (batch.status !== "VALIDATED") throw new ApiError(409, "IMPORT_NOT_READY", `${batch.code} must be checked before it can be approved`);
  const mapping = asMapping(batch.mapping)!;
  const handler = IMPORT_HANDLERS[batch.kind];

  const { ids, fields } = await fieldRows(id, mapping);
  const fresh = await handler.check(fields, ref(batch));
  const saved = await prisma.importRow.findMany({ where: { batchId: id }, orderBy: { rowNumber: "asc" }, select: { status: true } });
  const changed = fresh.results.some((r, i) => r.status !== saved[i]!.status);
  if (changed) {
    await withTransaction(async (tx) => {
      await saveRowResults(tx, ids, fields, fresh.results);
      await tx.importBatch.update({ where: { id }, data: { ...counts(fresh.results), summary: fresh.summary ?? [] } });
    });
    throw new ApiError(
      409,
      "IMPORT_STALE",
      "Records changed since this file was checked. The rows have been re-checked; review them and approve again.",
    );
  }
  if (fresh.units.length === 0) throw new ApiError(409, "NOTHING_TO_IMPORT", "No rows are ready to import");

  await withTransaction(
    async (tx) => {
      const claimed = await tx.importBatch.updateMany({ where: { id, status: "VALIDATED" }, data: { status: "IMPORTED" } });
      if (claimed.count === 0) throw new ApiError(409, "IMPORT_NOT_READY", `${batch.code} was already approved or cancelled`);

      const created = await handler.create(tx, ctx, ref(batch), fresh.units);
      const payload = [...created.entities].map(([index, e]) => ({ id: ids[index]!, entity: e.entity, entityId: e.id }));
      await tx.$executeRaw`
        UPDATE "ImportRow" r SET status = 'IMPORTED', "createdEntity" = v.entity, "createdEntityId" = v."entityId"
        FROM jsonb_to_recordset(${JSON.stringify(payload)}::jsonb) AS v(id text, entity text, "entityId" text)
        WHERE r.id = v.id`;
      await tx.importBatch.update({
        where: { id },
        data: {
          importedRows: payload.length,
          approvedById: ctx.userId,
          approvedAt: new Date(),
          stockDocumentId: created.stockDocumentId ?? null,
        },
      });
      await recordAudit(tx, ctx, {
        action: "import.approved",
        entity: "ImportBatch",
        entityId: id,
        after: { code: batch.code, kind: batch.kind, imported: payload.length, stockDocumentId: created.stockDocumentId ?? null },
      });
    },
    { timeout: APPROVE_TIMEOUT_MS },
  );
  return getImport(id);
}

/** Undoes an approved batch while nothing it created has been used; afterwards the records are archived, reversed or removed. */
export async function rollbackImport(id: string, reason: string, ctx: RequestContext) {
  const batch = await loadBatch(id);
  if (batch.status !== "IMPORTED") throw new ApiError(409, "IMPORT_NOT_IMPORTED", `${batch.code} has nothing to roll back`);
  const handler = IMPORT_HANDLERS[batch.kind];
  const rows = await createdRows(id);

  await withTransaction(
    async (tx) => {
      await handler.lockForRollback(tx, ref(batch), rows);
      const blocker = await handler.rollbackBlocker(tx, ref(batch), rows);
      if (blocker) throw new ApiError(409, "IMPORT_IN_USE", `Can't roll back ${batch.code}: ${blocker}`);
      const claimed = await tx.importBatch.updateMany({
        where: { id, status: "IMPORTED" },
        data: { status: "ROLLED_BACK", rolledBackById: ctx.userId, rolledBackAt: new Date(), rollbackReason: reason },
      });
      if (claimed.count === 0) throw new ApiError(409, "IMPORT_NOT_IMPORTED", `${batch.code} was already rolled back`);
      await handler.rollback(tx, ctx, ref(batch), rows, reason);
      await recordAudit(tx, ctx, {
        action: "import.rolled_back",
        entity: "ImportBatch",
        entityId: id,
        before: { created: rows },
        after: { reason },
      });
    },
    { timeout: APPROVE_TIMEOUT_MS },
  );
  return getImport(id);
}

export async function cancelImport(id: string, ctx: RequestContext) {
  const batch = await loadBatch(id);
  await withTransaction(async (tx) => {
    const claimed = await tx.importBatch.updateMany({
      where: { id, status: { in: ["UPLOADED", "VALIDATED"] } },
      data: { status: "CANCELLED" },
    });
    if (claimed.count === 0) throw new ApiError(409, "IMPORT_CLOSED", `${batch.code} can no longer be cancelled`);
    await recordAudit(tx, ctx, { action: "import.cancelled", entity: "ImportBatch", entityId: id, after: { code: batch.code } });
  });
  return getImport(id);
}

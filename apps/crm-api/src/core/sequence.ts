import type { Tx } from "@repo/crm-db/client";

/**
 * Next number for a document prefix (PRD, PUR, ...). Runs in the caller's
 * transaction: a rolled-back document never consumes a number, and concurrent
 * callers serialise on the counter row.
 */
export async function nextSequence(tx: Tx, key: string): Promise<number> {
  const [row] = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO "Sequence" (key, value) VALUES (${key}, 1)
    ON CONFLICT (key) DO UPDATE SET value = "Sequence".value + 1
    RETURNING value`;
  return row!.value;
}

export async function nextCode(tx: Tx, prefix: string, width = 4): Promise<string> {
  const n = await nextSequence(tx, prefix);
  return `${prefix}-${String(n).padStart(width, "0")}`;
}

/** Case- and whitespace-insensitive key for unique names ("Hot  Wheels" = "hot wheels"). */
export const nameKey = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

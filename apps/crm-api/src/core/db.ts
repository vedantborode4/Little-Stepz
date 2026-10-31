import { Prisma, prisma, type Tx } from "@repo/crm-db/client";

const MAX_ATTEMPTS = 3;

/** Postgres deadlock_detected and serialization_failure: the whole transaction can safely run again. */
const RETRYABLE_SQLSTATES = new Set(["40P01", "40001"]);

function isRetryable(err: unknown) {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (err.code === "P2034" || err.code === "P2028") return true;
  // Raw lock statements ($queryRaw ... FOR UPDATE) report a deadlock as P2010 with the SQLSTATE in meta.
  return err.code === "P2010" && RETRYABLE_SQLSTATES.has(String(err.meta?.code));
}

/**
 * Runs `fn` in one interactive transaction and retries on write conflicts or
 * serialization failures, so callers never hand-roll retry loops. `fn` must be
 * safe to re-run: do all reads and writes through `tx`.
 */
export async function withTransaction<T>(
  fn: (tx: Tx) => Promise<T>,
  options: { isolationLevel?: Prisma.TransactionIsolationLevel; timeout?: number } = {},
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await prisma.$transaction(fn, options);
    } catch (err) {
      if (attempt >= MAX_ATTEMPTS || !isRetryable(err)) throw err;
      await new Promise((r) => setTimeout(r, 25 * 2 ** attempt + Math.random() * 25));
    }
  }
}

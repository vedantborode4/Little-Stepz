import { Prisma, prisma, type Tx } from "@repo/crm-db/client";

const MAX_ATTEMPTS = 3;

function isRetryable(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && (err.code === "P2034" || err.code === "P2028");
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

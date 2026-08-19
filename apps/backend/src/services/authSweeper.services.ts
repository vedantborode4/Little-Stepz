import { prisma } from "@repo/db/client";

/**
 * Reap expired auth artefacts.
 *
 * `PendingSignup` rows carry a bcrypt password hash, so abandoned signups must not
 * accumulate indefinitely. Opportunistic cleanup ("delete on the next request for
 * this email") was rejected because it never fires for an address nobody retries —
 * exactly the abandoned case.
 *
 * Expired `PasswordResetToken` rows are swept too: they were only ever removed when
 * superseded, used, or the account was deleted, so abandoned reset requests piled up
 * forever. Safe, because every read path already filters on `expiresAt`.
 */
const INTERVAL_MS = Number(process.env.AUTH_SWEEP_INTERVAL_MS ?? 3_600_000);

/** Keep rows a little past expiry so a just-expired code reports "expired", not "invalid". */
const GRACE_MS = Number(process.env.AUTH_SWEEP_GRACE_MS ?? 60 * 60 * 1000);

export async function sweepExpiredAuthTokens(): Promise<{
  pendingSignups: number;
  resetTokens: number;
}> {
  const cutoff = new Date(Date.now() - GRACE_MS);

  const pendingSignups = (
    await prisma.pendingSignup.deleteMany({ where: { expiresAt: { lt: cutoff } } })
  ).count;

  const resetTokens = (
    await prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: cutoff } } })
  ).count;

  return { pendingSignups, resetTokens };
}

export function startAuthSweeper(): void {
  if (process.env.AUTH_SWEEP_ENABLED === "false") {
    console.log("[auth-sweeper] disabled via AUTH_SWEEP_ENABLED=false");
    return;
  }

  const tick = () => {
    void sweepExpiredAuthTokens()
      .then(({ pendingSignups, resetTokens }) => {
        if (pendingSignups || resetTokens) {
          console.log(
            `[auth-sweeper] removed ${pendingSignups} pending signup(s), ${resetTokens} reset token(s)`
          );
        }
      })
      .catch((err) => console.error("[auth-sweeper] sweep failed:", err));
  };

  // .unref() so this never holds the process open, matching the other sweepers.
  setInterval(tick, INTERVAL_MS).unref();
  console.log(`[auth-sweeper] running every ${INTERVAL_MS}ms`);
}

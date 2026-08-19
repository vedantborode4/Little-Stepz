// expo-server-sdk is ESM-only. This backend compiles to CommonJS, so we must NOT
// import it statically (that would emit a require() of an ES module and crash on
// Node <= 20). Instead we load it lazily via dynamic import(), which NodeNext
// preserves as a real import() and works on every Node version.
import type { Expo as ExpoType, ExpoPushMessage } from "expo-server-sdk";
export type { ExpoPushMessage };

let expoPromise: Promise<ExpoType> | null = null;

async function getExpo(): Promise<ExpoType> {
  if (!expoPromise) {
    expoPromise = import("expo-server-sdk").then(({ Expo }) => {
      const accessToken = process.env.EXPO_ACCESS_TOKEN;
      return new Expo(accessToken ? { accessToken } : {});
    });
  }
  return expoPromise;
}

// Matches Expo's own isExpoPushToken format check without needing the ESM module
// synchronously: ExponentPushToken[...] or ExpoPushToken[...].
const EXPO_TOKEN_RE = /^Expo(nent)?PushToken\[.+\]$/;

export function isValidExpoPushToken(token: string): boolean {
  return EXPO_TOKEN_RE.test(token);
}

export interface PushResult {
  /** Tokens the push service reported as unregistered — should be pruned. */
  invalidTokens: string[];
}

/**
 * How long to wait before asking Expo what actually happened to a batch. Expo hands
 * the message to FCM/APNs asynchronously, so a receipt is not available immediately.
 */
const RECEIPT_DELAY_MS = 15_000;

/**
 * A ticket only says "Expo accepted this message"; the *receipt* says whether FCM or
 * APNs actually delivered it. Every server-side push misconfiguration — above all a
 * missing FCM V1 service-account key on the Expo project — succeeds at the ticket
 * stage and fails here, which is exactly the "the in-app feed updates but the phone
 * never buzzes" symptom, and it is completely silent unless someone reads receipts.
 *
 * Runs detached on a timer: the caller must not wait 15s, and this must never be
 * able to reject into an unhandled rejection.
 */
function scheduleReceiptCheck(
  expo: ExpoType,
  ticketIds: string[],
  tokenByTicketId: Map<string, string>,
  onInvalidTokens: (tokens: string[]) => void
): void {
  if (ticketIds.length === 0) return;

  const timer = setTimeout(() => {
    void (async () => {
      const stale: string[] = [];
      for (const idChunk of expo.chunkPushNotificationReceiptIds(ticketIds)) {
        try {
          const receipts = await expo.getPushNotificationReceiptsAsync(idChunk);
          for (const [id, receipt] of Object.entries(receipts)) {
            if (receipt.status !== "error") continue;
            const token = tokenByTicketId.get(id);
            if (receipt.details?.error === "DeviceNotRegistered") {
              if (token) stale.push(token);
              continue;
            }
            console.error(
              "[push] undelivered:",
              receipt.details?.error ?? "unknown",
              receipt.message,
              token ? `token=${token}` : ""
            );
          }
        } catch (err) {
          console.error("[push] receipt fetch failed:", err);
        }
      }
      if (stale.length > 0) onInvalidTokens(stale);
    })();
  }, RECEIPT_DELAY_MS);

  // Don't hold the event loop open on shutdown just to read receipts.
  timer.unref?.();
}

/**
 * Fail-soft Expo push sender. Never throws — a push failure must not break the
 * business flow that triggered it. Batches into Expo's size-limited chunks and
 * collects tokens that came back as DeviceNotRegistered so callers can prune them.
 *
 * `onLateInvalidTokens` receives tokens found dead by the delayed receipt check,
 * long after this promise has resolved.
 */
export async function sendExpoPush(
  messages: ExpoPushMessage[],
  onLateInvalidTokens?: (tokens: string[]) => void
): Promise<PushResult> {
  const invalidTokens: string[] = [];
  if (messages.length === 0) return { invalidTokens };

  let expo: ExpoType;
  try {
    expo = await getExpo();
  } catch (err) {
    console.error("[push] failed to load expo-server-sdk:", err);
    return { invalidTokens };
  }

  const ticketIds: string[] = [];
  const tokenByTicketId = new Map<string, string>();

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      tickets.forEach((ticket, i) => {
        const to = chunk[i]?.to;
        const token = typeof to === "string" ? to : undefined;

        if (ticket.status === "error") {
          if (ticket.details?.error === "DeviceNotRegistered" && token) {
            invalidTokens.push(token);
          } else {
            console.error("[push] ticket error:", ticket.message, ticket.details);
          }
          return;
        }

        ticketIds.push(ticket.id);
        if (token) tokenByTicketId.set(ticket.id, token);
      });
    } catch (err) {
      console.error("[push] send chunk threw:", err);
    }
  }

  scheduleReceiptCheck(expo, ticketIds, tokenByTicketId, (tokens) => {
    onLateInvalidTokens?.(tokens);
  });

  return { invalidTokens };
}

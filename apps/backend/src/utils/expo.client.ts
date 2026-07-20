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
 * Fail-soft Expo push sender. Never throws — a push failure must not break the
 * business flow that triggered it. Batches into Expo's size-limited chunks and
 * collects tokens that came back as DeviceNotRegistered so callers can prune them.
 */
export async function sendExpoPush(messages: ExpoPushMessage[]): Promise<PushResult> {
  const invalidTokens: string[] = [];
  if (messages.length === 0) return { invalidTokens };

  let expo: ExpoType;
  try {
    expo = await getExpo();
  } catch (err) {
    console.error("[push] failed to load expo-server-sdk:", err);
    return { invalidTokens };
  }

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      tickets.forEach((ticket, i) => {
        if (ticket.status === "error") {
          const to = chunk[i]?.to;
          const token = typeof to === "string" ? to : undefined;
          if (ticket.details?.error === "DeviceNotRegistered" && token) {
            invalidTokens.push(token);
          } else {
            console.error("[push] ticket error:", ticket.message, ticket.details);
          }
        }
      });
    } catch (err) {
      console.error("[push] send chunk threw:", err);
    }
  }

  return { invalidTokens };
}

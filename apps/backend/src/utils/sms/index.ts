import { consoleProvider } from "./providers/console.provider";
import { msg91Provider } from "./providers/msg91.provider";
import { smsGatewayHubProvider } from "./providers/smsgatewayhub.provider";
import { twilioProvider } from "./providers/twilio.provider";
import type { SmsMessage, SmsProvider, SmsSendResult } from "./types";

export * from "./types";
export * from "./phone";
export * from "./templates";

let cached: SmsProvider | null = null;

/**
 * Resolve the configured provider once. Memoised like `expo.client.ts`'s getExpo().
 *
 * A production instance that falls back to `console` would answer 200 while silently
 * sending nothing — the same failure mode `.env.sample` already warns about for
 * Resend — so that combination is logged loudly at first use.
 */
export function getSmsProvider(): SmsProvider {
  if (cached) return cached;

  const name = (process.env.SMS_PROVIDER ?? "console").toLowerCase();

  switch (name) {
    case "smsgatewayhub":
      cached = smsGatewayHubProvider;
      break;
    case "msg91":
      cached = msg91Provider;
      break;
    case "twilio":
      cached = twilioProvider;
      break;
    default:
      cached = consoleProvider;
      if (process.env.NODE_ENV === "production") {
        console.error(
          "[sms] SMS_PROVIDER is not configured — running the console provider in " +
            "production. Phone verification will appear to work while no SMS is sent."
        );
      }
  }

  return cached;
}

/** Facade so callers never import a provider directly. */
export function sendSms(msg: SmsMessage): Promise<SmsSendResult> {
  return getSmsProvider().send(msg);
}

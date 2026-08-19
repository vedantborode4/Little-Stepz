import { randomUUID } from "crypto";
import { maskPhone } from "../phone";
import type { SmsMessage, SmsProvider, SmsSendResult } from "../types";

/**
 * Dev/no-op provider — logs instead of sending, so the whole OTP flow can be
 * exercised for free. The raw code is printed only outside production.
 */
export const consoleProvider: SmsProvider = {
  name: "console",

  async send(msg: SmsMessage): Promise<SmsSendResult> {
    if (process.env.NODE_ENV === "production") {
      console.warn(`[sms] (not sent) to=${maskPhone(msg.to)} template=${msg.templateKey}`);
    } else {
      console.log(`[sms] (not sent) to=${maskPhone(msg.to)} text=${msg.text}`);
    }

    return { ok: true, providerMessageId: `console-${randomUUID()}` };
  },
};

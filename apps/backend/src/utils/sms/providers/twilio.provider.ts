import { maskPhone, toE164India } from "../phone";
import type { SmsMessage, SmsProvider, SmsSendResult } from "../types";

/**
 * Twilio Messages API, form-encoded with Basic auth. No SDK, for the same reason as
 * MSG91.
 *
 * Twilio's API carries only the rendered body — the DLT entity/template ids are
 * configured in their console against the sender — which is exactly why
 * `SmsMessage.text` must be the registered template text verbatim.
 */
export const twilioProvider: SmsProvider = {
  name: "twilio",

  async send(msg: SmsMessage): Promise<SmsSendResult> {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM;

    if (!sid || !token || !from) {
      return {
        ok: false,
        errorCode: "SMS_NOT_CONFIGURED",
        error: "TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN or TWILIO_FROM is not set",
      };
    }

    const body = new URLSearchParams({
      To: toE164India(msg.to),
      From: from,
      Body: msg.text,
    }).toString();

    try {
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body,
        }
      );

      const data = (await res.json().catch(() => ({}))) as any;

      if (!res.ok) {
        console.error("[sms] twilio send failed", {
          httpStatus: res.status,
          to: maskPhone(msg.to),
          response: data,
        });
        return {
          ok: false,
          errorCode: String(data?.code ?? res.status),
          error: String(data?.message ?? `HTTP ${res.status}`),
        };
      }

      return { ok: true, providerMessageId: data?.sid ?? undefined };
    } catch (err: any) {
      console.error(`[sms] twilio threw for ${maskPhone(msg.to)}:`, err?.message ?? err);
      return { ok: false, errorCode: "NETWORK", error: err?.message ?? "network error" };
    }
  },
};

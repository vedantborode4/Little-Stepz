import { maskPhone, toMsg91Mobile } from "../phone";
import type { SmsMessage, SmsProvider, SmsSendResult } from "../types";

/**
 * MSG91 Flow API. Uses global `fetch` — no SDK, so no dependency and none of the
 * CommonJS/ESM trouble an ESM-only client would bring to this backend.
 *
 * NOTE: verify the payload against MSG91's current docs before going live — the
 * shape (whether the sender is a body param or bound to the template, and the
 * variable naming convention) has changed across their API versions.
 */
const MSG91_FLOW_URL = "https://control.msg91.com/api/v5/flow/";

export const msg91Provider: SmsProvider = {
  name: "msg91",

  async send(msg: SmsMessage): Promise<SmsSendResult> {
    const authKey = process.env.MSG91_AUTH_KEY;
    const templateId = process.env.SMS_TEMPLATE_ID_PHONE_OTP;

    if (!authKey || !templateId) {
      return {
        ok: false,
        errorCode: "SMS_NOT_CONFIGURED",
        error: "MSG91_AUTH_KEY or SMS_TEMPLATE_ID_PHONE_OTP is not set",
      };
    }

    try {
      const res = await fetch(MSG91_FLOW_URL, {
        method: "POST",
        headers: {
          authkey: authKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          template_id: templateId,
          short_url: "0",
          ...(process.env.MSG91_SENDER_ID ? { sender: process.env.MSG91_SENDER_ID } : {}),
          recipients: [{ mobiles: toMsg91Mobile(msg.to), ...msg.variables }],
        }),
      });

      const data = (await res.json().catch(() => ({}))) as any;

      // Like Delhivery, a rejection can arrive as a 200 with an error body.
      if (!res.ok || data?.type === "error" || data?.hasError) {
        console.error("[sms] msg91 send failed", {
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

      return { ok: true, providerMessageId: data?.request_id ?? undefined };
    } catch (err: any) {
      console.error(`[sms] msg91 threw for ${maskPhone(msg.to)}:`, err?.message ?? err);
      return { ok: false, errorCode: "NETWORK", error: err?.message ?? "network error" };
    }
  },
};

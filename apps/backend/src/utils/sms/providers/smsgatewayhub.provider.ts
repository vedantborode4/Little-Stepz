import { maskPhone, toIndianMobile } from "../phone";
import type { SmsHealth, SmsMessage, SmsProvider, SmsSendResult } from "../types";

/**
 * SMSGatewayHub HTTP API.
 *
 * Docs: https://www.smsgatewayhub.com/free-sms-gateway-developer-api
 *   GET /api/mt/SendSMS?APIKey=..&senderid=..&channel=2&DCS=0&flashsms=0
 *       &number=91XXXXXXXXXX&text=..&route=1&EntityId=..&dlttemplateid=..
 *
 * Uses global `fetch` — no SDK, so no new dependency and none of the CommonJS/ESM
 * trouble an ESM-only client would cause in this backend.
 */
const SEND_URL = "https://www.smsgatewayhub.com/api/mt/SendSMS";

/**
 * The gateway is inconsistent about zero-padding: the docs show `"000"` for success
 * and `"007"` for bad credentials, but the live API actually returns `"7"`. Strip
 * leading zeros before comparing so both spellings of success are recognised —
 * without this a successful send could be misread as a failure (and retried, at cost).
 */
function isSuccess(errorCode: string): boolean {
  // A missing/empty ErrorCode is NOT success — an HTML error page or a shape change
  // would otherwise be reported as a delivered SMS.
  if (!errorCode) return false;
  return errorCode.replace(/^0+/, "") === "";
}

const BALANCE_URL = "https://www.smsgatewayhub.com/api/mt/GetBalance";
const SENDERS_URL = "https://www.smsgatewayhub.com/api/mt/GetSenderId";

export const smsGatewayHubProvider: SmsProvider = {
  name: "smsgatewayhub",

  /**
   * Verify credentials, balance and that the configured sender is actually approved.
   * All three fail silently at send time otherwise — an unapproved header comes back
   * as `006 Invalid senderid`, which is only visible per-message.
   */
  async healthCheck(): Promise<SmsHealth> {
    const apiKey = process.env.SMSGATEWAYHUB_API_KEY;
    const senderId = process.env.SMSGATEWAYHUB_SENDER_ID;

    if (!apiKey) return { ok: false, detail: "SMSGATEWAYHUB_API_KEY is not set" };

    try {
      const balRes = await fetch(`${BALANCE_URL}?APIKey=${encodeURIComponent(apiKey)}`);
      const bal = (await balRes.json().catch(() => ({}))) as any;

      if (!isSuccess(String(bal?.ErrorCode ?? ""))) {
        return { ok: false, detail: `credentials rejected (${bal?.ErrorMessage ?? "unknown"})` };
      }

      const sendRes = await fetch(`${SENDERS_URL}?APIKey=${encodeURIComponent(apiKey)}`);
      const senders = (await sendRes.json().catch(() => ({}))) as any;
      // Only Active headers can actually send; a pending/rejected one still appears here.
      const approved: string[] = Array.isArray(senders?.Data)
        ? senders.Data
            .filter((s: any) => String(s?.Statuss ?? "Active").toLowerCase() === "active")
            .map((s: any) => String(s?.SenderId ?? ""))
            .filter(Boolean)
        : [];

      if (!approved.length) {
        return {
          ok: false,
          detail: `balance ${bal?.Balance ?? "?"} but NO active sender IDs on this account — add the DLT header on the SMSGatewayHub panel`,
        };
      }

      if (senderId && !approved.includes(senderId)) {
        return {
          ok: false,
          detail: `SMSGATEWAYHUB_SENDER_ID "${senderId}" is not active (active: ${approved.join(", ")})`,
        };
      }

      // A missing template id or body is a guaranteed `024 template mismatch` at send
      // time — catch it here rather than one failed verification at a time.
      const missing = [
        !process.env.SMS_TEMPLATE_ID_PHONE_OTP && "SMS_TEMPLATE_ID_PHONE_OTP",
        !process.env.SMS_TEMPLATE_PHONE_OTP && "SMS_TEMPLATE_PHONE_OTP",
        !process.env.SMSGATEWAYHUB_ENTITY_ID && "SMSGATEWAYHUB_ENTITY_ID",
      ].filter(Boolean);

      if (missing.length) {
        return {
          ok: false,
          detail: `sender "${senderId}" is active but DLT config is incomplete — missing ${missing.join(", ")}`,
        };
      }

      return { ok: true, detail: `balance ${bal?.Balance ?? "?"}, sender(s): ${approved.join(", ")}` };
    } catch (err: any) {
      return { ok: false, detail: `health check failed: ${err?.message ?? err}` };
    }
  },

  async send(msg: SmsMessage): Promise<SmsSendResult> {
    const apiKey = process.env.SMSGATEWAYHUB_API_KEY;
    const senderId = process.env.SMSGATEWAYHUB_SENDER_ID;
    const entityId = process.env.SMSGATEWAYHUB_ENTITY_ID;
    const templateId = process.env.SMS_TEMPLATE_ID_PHONE_OTP;

    if (!apiKey || !senderId) {
      return {
        ok: false,
        errorCode: "SMS_NOT_CONFIGURED",
        error: "SMSGATEWAYHUB_API_KEY or SMSGATEWAYHUB_SENDER_ID is not set",
      };
    }

    const params = new URLSearchParams({
      APIKey: apiKey,
      senderid: senderId,
      channel: "2", // 2 = Transactional. OTPs must never go on the promotional route.
      DCS: "0", // plain GSM-7; 8 would be unicode
      flashsms: "0",
      number: toIndianMobile(msg.to),
      text: msg.text,
      route: "1",
    });

    // DLT identifiers. Without them the operator rejects transactional traffic, so
    // send them whenever they're configured rather than silently omitting.
    if (entityId) params.set("EntityId", entityId);
    if (templateId) params.set("dlttemplateid", templateId);
    const telemarketerId = process.env.SMSGATEWAYHUB_TELEMARKETER_ID;
    if (telemarketerId) params.set("telemarketerid", telemarketerId);

    try {
      const res = await fetch(`${SEND_URL}?${params.toString()}`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      const data = (await res.json().catch(() => ({}))) as any;
      const code = String(data?.ErrorCode ?? "");

      // Same trap as Delhivery and MSG91: a rejection arrives as HTTP 200 with an
      // error body, so the status code alone proves nothing.
      if (!res.ok || !isSuccess(code)) {
        console.error("[sms] smsgatewayhub send failed", {
          httpStatus: res.status,
          to: maskPhone(msg.to),
          errorCode: code,
          errorMessage: data?.ErrorMessage,
        });
        return {
          ok: false,
          errorCode: code || String(res.status),
          error: String(data?.ErrorMessage ?? `HTTP ${res.status}`),
        };
      }

      const messageId = data?.MessageData?.[0]?.MessageId ?? data?.JobId;

      // Logged so a "customer says it never arrived" can be traced with
      // GET /api/mt/GetDelivery?jobid=... — acceptance is not delivery.
      console.log(
        `[sms] smsgatewayhub sent to=${maskPhone(msg.to)} jobId=${data?.JobId ?? "?"} messageId=${messageId ?? "?"}`
      );

      return { ok: true, providerMessageId: messageId };
    } catch (err: any) {
      console.error(`[sms] smsgatewayhub threw for ${maskPhone(msg.to)}:`, err?.message ?? err);
      return { ok: false, errorCode: "NETWORK", error: err?.message ?? "network error" };
    }
  },
};

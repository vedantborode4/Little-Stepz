/**
 * Provider-agnostic SMS interface.
 *
 * Shaped by India's DLT rules rather than by convenience: commercial SMS to Indian
 * numbers must go out on a registered 6-character sender header using a
 * pre-registered template. If the delivered text doesn't match a registered
 * template the operator drops it — and the vendor API still returns success. So a
 * bare `sendSms(to, text)` would be actively dangerous: it invites callers to
 * compose free text that India silently discards.
 *
 * `SmsMessage` therefore carries BOTH shapes, because the vendors disagree:
 *   - MSG91's Flow API wants a template id plus named variables.
 *   - Twilio's Messages API wants rendered body text (DLT ids live in their console).
 */
export type SmsTemplateKey = "PHONE_OTP";

export interface SmsMessage {
  /** Bare 10 digits, as guaranteed by `phoneSchema`. Country code is added per provider. */
  to: string;
  templateKey: SmsTemplateKey;
  /** Template variables, in the order the DLT template declares them. */
  variables: Record<string, string>;
  /** The exact rendered body, byte-identical to the registered DLT template. */
  text: string;
}

export interface SmsSendResult {
  ok: boolean;
  providerMessageId?: string;
  errorCode?: string;
  /** Provider diagnostics. Logged, never returned to the client. */
  error?: string;
}

export interface SmsHealth {
  ok: boolean;
  /** Human-readable summary for the boot log. */
  detail: string;
}

export interface SmsProvider {
  readonly name: string;
  /**
   * Never throws — returns `ok: false` instead. The *service* decides what a failure
   * means, because unlike email/push (side channels), an OTP send IS the request.
   */
  send(msg: SmsMessage): Promise<SmsSendResult>;
  /**
   * Optional boot check. The failure mode this guards against is the nasty one:
   * credentials/sender/template misconfigured means the API accepts the call and the
   * operator drops the SMS, so nothing looks wrong until customers can't sign in.
   */
  healthCheck?(): Promise<SmsHealth>;
}

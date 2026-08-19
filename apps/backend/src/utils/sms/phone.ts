/**
 * Country-code handling lives here, not in `phoneSchema`.
 *
 * Stored numbers are bare 10 digits everywhere (Address.phone, VerifiedPhone.phone,
 * and what reaches Delhivery); changing that format would invalidate every stored
 * address. The `+91` is a transport detail each provider wants differently.
 */

/** E.164, for Twilio. */
export function toE164India(phone: string): string {
  return `+91${phone}`;
}

/** `91XXXXXXXXXX` — what MSG91 and SMSGatewayHub both expect. */
export function toIndianMobile(phone: string): string {
  return `91${phone}`;
}

/** Never log a full phone number. */
export function maskPhone(phone: string): string {
  if (phone.length < 4) return "****";
  return `${phone.slice(0, 2)}${"*".repeat(phone.length - 4)}${phone.slice(-2)}`;
}

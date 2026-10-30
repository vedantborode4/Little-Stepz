/**
 * Customer contact details are personal data: lists, exports and reports show
 * them masked. Full values only leave the API through the audited reveal
 * endpoint or an admin's full-contact export. The last four digits stay visible
 * so staff can confirm a number the customer reads out.
 */
export function maskMobile(e164: string | null): string | null {
  if (!e164) return null;
  const country = e164.startsWith("+91") ? "+91 " : "";
  return `${country}••••••${e164.slice(-4)}`;
}

export function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [user = "", domain = ""] = email.split("@");
  return `${user.slice(0, 1)}•••@${domain}`;
}

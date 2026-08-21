/**
 * Single source of truth for the customer-support channels.
 *
 * These details are rendered by the web support page, the site footer and the
 * policy copy, and are what Apple's "Support URL" review checks against — they
 * must agree everywhere, so nothing here should be retyped at a call site.
 */
export const SUPPORT_EMAIL = "support@littlestepz.in";

/** E.164, for `tel:` and `wa.me` links. */
export const SUPPORT_PHONE_E164 = "+919920634567";

/** Display form of the same number. */
export const SUPPORT_PHONE_DISPLAY = "+91 99206 34567";

export const SUPPORT_WHATSAPP_URL = `https://wa.me/${SUPPORT_PHONE_E164.replace("+", "")}`;

export const SUPPORT_HOURS = "Monday to Friday, 10:00 AM – 6:00 PM IST";

export const SUPPORT_RESPONSE_TIME =
  "We reply to every email within 24–48 working hours.";

export const BUSINESS_ADDRESS =
  "H.No. 1-5-431/34/19/1, Laxmi Nagar, Old Alwal, Secunderabad, Medchal–Malkajgiri District, Hyderabad, Telangana – 500010, India";

export const BUSINESS_CITY = "Hyderabad, India";

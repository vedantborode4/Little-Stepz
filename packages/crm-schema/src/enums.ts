/**
 * Enum values mirror the Prisma enums in @repo/crm-db. They live here as plain
 * const arrays so clients get values and labels without depending on Prisma;
 * crm-api asserts at compile time that both sides stay identical.
 */

export const ROLES = ["ADMIN", "CASHIER", "OPS"] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  CASHIER: "Cashier",
  OPS: "Operations",
};

export const PAYMENT_METHODS = ["CASH", "UPI", "GATEWAY", "BANK", "OTHER"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Cash",
  UPI: "PhonePe / UPI",
  GATEWAY: "Website Gateway",
  BANK: "Bank Transfer",
  OTHER: "Other",
};

export const LOCATION_TYPES = ["STORE", "WAREHOUSE"] as const;
export type LocationType = (typeof LOCATION_TYPES)[number];
export const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  STORE: "Store",
  WAREHOUSE: "Godown / Warehouse",
};

/** GST state codes. The business state decides intra-state (CGST+SGST) vs inter-state (IGST). */
export const INDIAN_STATES = [
  { code: "01", name: "Jammu & Kashmir" },
  { code: "02", name: "Himachal Pradesh" },
  { code: "03", name: "Punjab" },
  { code: "04", name: "Chandigarh" },
  { code: "05", name: "Uttarakhand" },
  { code: "06", name: "Haryana" },
  { code: "07", name: "Delhi" },
  { code: "08", name: "Rajasthan" },
  { code: "09", name: "Uttar Pradesh" },
  { code: "10", name: "Bihar" },
  { code: "11", name: "Sikkim" },
  { code: "12", name: "Arunachal Pradesh" },
  { code: "13", name: "Nagaland" },
  { code: "14", name: "Manipur" },
  { code: "15", name: "Mizoram" },
  { code: "16", name: "Tripura" },
  { code: "17", name: "Meghalaya" },
  { code: "18", name: "Assam" },
  { code: "19", name: "West Bengal" },
  { code: "20", name: "Jharkhand" },
  { code: "21", name: "Odisha" },
  { code: "22", name: "Chhattisgarh" },
  { code: "23", name: "Madhya Pradesh" },
  { code: "24", name: "Gujarat" },
  { code: "26", name: "Dadra & Nagar Haveli and Daman & Diu" },
  { code: "27", name: "Maharashtra" },
  { code: "29", name: "Karnataka" },
  { code: "30", name: "Goa" },
  { code: "31", name: "Lakshadweep" },
  { code: "32", name: "Kerala" },
  { code: "33", name: "Tamil Nadu" },
  { code: "34", name: "Puducherry" },
  { code: "35", name: "Andaman & Nicobar Islands" },
  { code: "36", name: "Telangana" },
  { code: "37", name: "Andhra Pradesh" },
  { code: "38", name: "Ladakh" },
] as const;
export type StateCode = (typeof INDIAN_STATES)[number]["code"];
export const STATE_CODES = INDIAN_STATES.map((s) => s.code) as [StateCode, ...StateCode[]];

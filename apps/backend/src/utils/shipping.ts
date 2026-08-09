import { Decimal } from "decimal.js";
import { ApiError } from "./api";
import { PaymentErrorCode } from "./paymentErrors";
import {
  checkServiceability,
  getShippingRate,
  getOriginPincode,
  getDefaultPackageWeightGrams,
} from "./delhivery.client";

// Hard-block orders to pincodes Delhivery cannot serve.
// Fails OPEN (allows the order) only when the serviceability API itself errors, so a
// Delhivery outage never takes down checkout — we block only on a definitive "not serviceable".
export async function assertServiceable(pincode: string): Promise<void> {
  let result;
  try {
    result = await checkServiceability(pincode);
  } catch {
    return; // fail-open on network/API error
  }
  if (!result.serviceable) {
    throw new ApiError(400, PaymentErrorCode.PINCODE_NOT_SERVICEABLE);
  }
}

// Delivery is free for the customer — the business absorbs the carrier cost. Set
// FREE_SHIPPING=false to go back to billing the customer. NOTE: web's checkout summary computes
// its displayed total as `subtotal - discount` and hardcodes "Shipping: Free"; make it read
// /checkout/calculate before ever turning this off, or web will under-display the charged total.
export function isFreeShippingEnabled(): boolean {
  return (process.env.FREE_SHIPPING ?? "true").toLowerCase() !== "false";
}

// Live Delhivery shipping rate for a destination pincode, with a configured flat fallback so
// checkout never hard-fails on a shipping-cost lookup. Estimates as Pre-paid.
export async function resolveShippingCharge(destPincode: string): Promise<Decimal> {
  if (isFreeShippingEnabled()) return new Decimal(0);

  const fallback  = new Decimal(process.env.DELHIVERY_FALLBACK_SHIPPING ?? "50");
  const originPin = getOriginPincode();

  if (!originPin) return fallback;

  try {
    const amount = await getShippingRate({
      originPin,
      destPin:     destPincode,
      weightGrams: getDefaultPackageWeightGrams(),
      paymentMode: "Pre-paid",
    });
    if (!Number.isFinite(amount) || amount <= 0) return fallback;
    return new Decimal(amount);
  } catch {
    return fallback;
  }
}

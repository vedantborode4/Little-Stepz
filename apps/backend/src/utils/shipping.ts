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
//
// `paymentMethod` matters: plenty of pincodes are prepaid-only. Delhivery already
// reports that as `cod: false`, but the flag was never read, so a COD order to such a
// pincode was accepted at checkout and only failed later at manifest time — after the
// customer had been told their order was confirmed.
export async function assertServiceable(
  pincode: string,
  paymentMethod: "ONLINE" | "COD" = "ONLINE"
): Promise<void> {
  let result;
  try {
    result = await checkServiceability(pincode);
  } catch {
    return; // fail-open on network/API error
  }
  if (!result.serviceable) {
    throw new ApiError(400, PaymentErrorCode.PINCODE_NOT_SERVICEABLE);
  }
  if (paymentMethod === "COD" && !result.cod) {
    throw new ApiError(400, PaymentErrorCode.COD_NOT_AVAILABLE);
  }
}

/**
 * Serviceability for an order whose balance will be collected at the door.
 *
 * Deliberately the opposite failure policy to `assertServiceable`, which fails OPEN so a
 * Delhivery outage never takes down checkout. Failing open is right when the only risk is
 * a delivery we might not manage; it is wrong here, because accepting the order means
 * taking a deposit for a pincode where the remaining 80% can never be collected — the
 * customer is charged, the parcel cannot be manifested as COD, and someone has to unpick
 * it by hand.
 *
 * The customer loses nothing by being offered full prepayment instead, so this fails CLOSED
 * on a lookup error and the caller degrades to the full-payment plan.
 */
export async function assertCodCollectable(pincode: string): Promise<void> {
  let result;
  try {
    result = await checkServiceability(pincode);
  } catch {
    throw new ApiError(503, PaymentErrorCode.COD_NOT_AVAILABLE);
  }
  if (!result.serviceable) {
    throw new ApiError(400, PaymentErrorCode.PINCODE_NOT_SERVICEABLE);
  }
  if (!result.cod) {
    throw new ApiError(400, PaymentErrorCode.COD_NOT_AVAILABLE);
  }
}

/**
 * Non-throwing form for the checkout quote, which must show or hide the partial-payment
 * option rather than reject the whole request. Same fail-closed policy.
 */
export async function isCodCollectable(pincode: string): Promise<boolean> {
  try {
    const result = await checkServiceability(pincode);
    return Boolean(result.serviceable && result.cod);
  } catch {
    return false;
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
// checkout never hard-fails on a shipping-cost lookup.
//
// The rate is quoted for the actual payment mode: COD carries a collection fee, so
// quoting every order as Pre-paid under-charged shipping on every COD order.
// (Dormant while FREE_SHIPPING is on, since the customer is charged nothing either way.)
export async function resolveShippingCharge(
  destPincode: string,
  paymentMethod: "ONLINE" | "COD" = "ONLINE"
): Promise<Decimal> {
  if (isFreeShippingEnabled()) return new Decimal(0);

  const fallback  = new Decimal(process.env.DELHIVERY_FALLBACK_SHIPPING ?? "50");
  const originPin = getOriginPincode();

  if (!originPin) return fallback;

  try {
    const amount = await getShippingRate({
      originPin,
      destPin:     destPincode,
      weightGrams: getDefaultPackageWeightGrams(),
      paymentMode: paymentMethod === "COD" ? "COD" : "Pre-paid",
    });
    if (!Number.isFinite(amount) || amount <= 0) return fallback;
    return new Decimal(amount);
  } catch {
    return fallback;
  }
}

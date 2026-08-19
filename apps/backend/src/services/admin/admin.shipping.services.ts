import { ApiError } from "../../utils/api";
import {
  createDelhiveryWarehouse,
  fetchDelhiveryWarehouse,
  getOriginPincode,
  getPickupName,
  verifyDelhiveryAuth,
  type DelhiveryWarehouseInput,
} from "../../utils/delhivery.client";

/**
 * Pickup-warehouse administration.
 *
 * Shipment creation references the warehouse by name only, so a name that isn't
 * registered on the token's account fails every manifest with
 * "ClientWarehouse matching query does not exist." — per order, with no way to tell
 * it apart from an unserviceable pincode. Nothing in the repo could register or even
 * inspect a warehouse, so the state was invisible. These two operations make it
 * checkable and fixable from the admin panel.
 */

function warehouseInputFromEnv(): DelhiveryWarehouseInput {
  const name = getPickupName();
  const email = process.env.DELHIVERY_WAREHOUSE_EMAIL;
  const phone = process.env.DELHIVERY_WAREHOUSE_PHONE;
  const address = process.env.DELHIVERY_WAREHOUSE_ADDRESS;
  const city = process.env.DELHIVERY_WAREHOUSE_CITY;
  const state = process.env.DELHIVERY_WAREHOUSE_STATE;
  const pin = process.env.DELHIVERY_WAREHOUSE_PIN ?? getOriginPincode();

  const missing = Object.entries({
    DELHIVERY_PICKUP_NAME: name,
    DELHIVERY_WAREHOUSE_EMAIL: email,
    DELHIVERY_WAREHOUSE_PHONE: phone,
    DELHIVERY_WAREHOUSE_ADDRESS: address,
    DELHIVERY_WAREHOUSE_CITY: city,
    DELHIVERY_WAREHOUSE_STATE: state,
    DELHIVERY_WAREHOUSE_PIN: pin,
  })
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length) {
    throw new ApiError(400, `Missing warehouse configuration: ${missing.join(", ")}`);
  }

  return {
    name: name!,
    email: email!,
    phone: phone!,
    address: address!,
    city: city!,
    state: state!,
    pin: pin!,
  };
}

export async function getWarehouseStatusService() {
  const configuredName = getPickupName();

  const missing = Object.entries({
    DELHIVERY_API_TOKEN: process.env.DELHIVERY_API_TOKEN,
    DELHIVERY_PICKUP_NAME: configuredName,
  })
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length) {
    return {
      configuredName: configuredName ?? null,
      authenticated: false,
      /** null, not false — see below. */
      registered: null as boolean | null,
      warehouse: null,
      message: `Missing shipping configuration: ${missing.join(", ")}`,
    };
  }

  const authenticated = await verifyDelhiveryAuth();

  if (!authenticated) {
    return {
      configuredName: configuredName!,
      authenticated: false,
      registered: null as boolean | null,
      warehouse: null,
      message:
        "Delhivery rejected our API token. Fix DELHIVERY_API_TOKEN before anything else.",
    };
  }

  // `registered` is deliberately NULL, never false.
  //
  // Delhivery exposes no dependable way to read a pickup location back:
  // /api/backend/clientwarehouse/<name>/ answers 404 even for warehouses that
  // manifest successfully. An earlier version of this reported `registered: false`
  // for a working warehouse — a confidently wrong answer, which is precisely the
  // failure this endpoint exists to eliminate. The only real test is a manifest.
  const warehouse = await fetchDelhiveryWarehouse(configuredName!).catch(() => null);

  return {
    configuredName: configuredName!,
    authenticated: true,
    registered: warehouse !== null ? true : null,
    warehouse,
    message:
      warehouse !== null
        ? `Pickup warehouse "${configuredName}" is registered.`
        : `Credentials are valid and "${configuredName}" is configured. Delhivery has no reliable ` +
          `read-back for pickup locations, so registration can only be confirmed by shipping an ` +
          `order — a wrong name fails with "ClientWarehouse matching query does not exist".`,
  };
}

export async function registerWarehouseService() {
  const input = warehouseInputFromEnv();

  // Registering a name that already exists is an error on Delhivery's side, and the
  // realistic case for pressing this button twice is "did it work?" — so answer that
  // instead of failing.
  const existing = await fetchDelhiveryWarehouse(input.name).catch(() => null);
  if (existing !== null) {
    return { created: false, alreadyRegistered: true, warehouse: existing };
  }

  const warehouse = await createDelhiveryWarehouse(input);

  return { created: true, alreadyRegistered: false, warehouse };
}

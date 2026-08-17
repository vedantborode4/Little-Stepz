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

  if (!configuredName) {
    return {
      configuredName: null,
      registered: false,
      warehouse: null,
      message:
        "DELHIVERY_PICKUP_NAME is not set. Shipment creation will fail until it is configured.",
    };
  }

  const warehouse = await fetchDelhiveryWarehouse(configuredName);

  if (warehouse !== null) {
    return {
      configuredName,
      registered: true,
      authenticated: true,
      warehouse,
      message: "Pickup warehouse is registered with Delhivery.",
    };
  }

  // The lookup 404s for a bad token just as it does for a missing warehouse, so
  // confirm the credentials before blaming the warehouse.
  const authenticated = await verifyDelhiveryAuth();

  return {
    configuredName,
    registered: false,
    authenticated,
    warehouse: null,
    message: authenticated
      ? `No warehouse named "${configuredName}" exists on this Delhivery account. Register it before shipping.`
      : "Delhivery rejected our API token. Fix DELHIVERY_API_TOKEN — the warehouse cannot be checked until it is valid.",
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

import {
  fetchDelhiveryWarehouse,
  getPickupName,
  verifyDelhiveryAuth,
} from "../utils/delhivery.client";
import { getSmsProvider } from "../utils/sms";

/**
 * Confirm the SMS provider can actually deliver.
 *
 * Phone verification's worst failure mode is silent: wrong credentials, an
 * unapproved sender header or a template mismatch all let the API return success
 * while the operator drops the message. Checking at boot turns that into one log
 * line instead of customers who can't verify a number.
 */
export async function checkSmsProvider(): Promise<void> {
  const provider = getSmsProvider();

  if (provider.name === "console") {
    console.warn(
      "[preflight] SMS_PROVIDER=console — phone verification will log codes, not send them."
    );
    return;
  }

  if (!provider.healthCheck) {
    console.log(`[preflight] SMS provider "${provider.name}" configured (no health check available).`);
    return;
  }

  try {
    const health = await provider.healthCheck();
    if (health.ok) {
      console.log(`[preflight] SMS provider "${provider.name}" ready — ${health.detail}`);
    } else {
      console.error(`[preflight] SMS provider "${provider.name}" NOT ready — ${health.detail}`);
    }
  } catch (err: any) {
    console.warn(`[preflight] Could not verify the SMS provider: ${err?.message ?? err}`);
  }
}

/**
 * Check at boot that the configured pickup warehouse actually resolves.
 *
 * Shipment creation references the warehouse by name only, so a name Delhivery
 * doesn't know fails every single manifest with "ClientWarehouse matching query
 * does not exist." — discovered one order at a time, three auto-ship attempts deep,
 * long after the orders started piling up. One call at startup turns that into a
 * line in the boot log.
 *
 * Fail-soft by design: never block startup on Delhivery being reachable, mirroring
 * how `assertServiceable` fails open on a courier outage.
 */
export async function checkDelhiveryWarehouse(): Promise<void> {
  const name = getPickupName();

  if (!process.env.DELHIVERY_API_TOKEN) {
    console.warn("[preflight] DELHIVERY_API_TOKEN is not set — shipping is disabled.");
    return;
  }

  if (!name) {
    console.error(
      "[preflight] DELHIVERY_PICKUP_NAME is not set — every shipment will fail with a 500."
    );
    return;
  }

  try {
    const warehouse = await fetchDelhiveryWarehouse(name);

    if (warehouse === null) {
      // The warehouse endpoint 404s for a bad token exactly as it does for a missing
      // warehouse. Check the credentials before telling anyone to register one.
      if (!(await verifyDelhiveryAuth())) {
        console.error(
          "[preflight] Delhivery rejected DELHIVERY_API_TOKEN. Shipping is broken and the " +
            "pickup warehouse cannot be checked until the token is valid."
        );
        return;
      }

      console.error(
        `[preflight] Delhivery has no pickup warehouse named "${name}" on this account. ` +
          `Every shipment will fail with "ClientWarehouse matching query does not exist". ` +
          `Register it via POST /api/v1/admin/shipping/warehouse, or correct ` +
          `DELHIVERY_PICKUP_NAME to match the name in the Delhivery panel exactly.`
      );
      return;
    }

    console.log(`[preflight] Delhivery pickup warehouse "${name}" is registered.`);
  } catch (err: any) {
    // A courier outage at boot says nothing about our configuration.
    console.warn(
      `[preflight] Could not verify the Delhivery warehouse: ${err?.message ?? err}`
    );
  }
}

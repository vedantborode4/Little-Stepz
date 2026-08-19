import {
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
 * Check at boot that Delhivery credentials work.
 *
 * Deliberately does NOT assert that the pickup warehouse exists. Delhivery's
 * `/api/backend/clientwarehouse/<name>/` endpoint returns 404 even for pickup
 * locations that manifest successfully — it is a web-panel route, not an API — so an
 * earlier version of this check reported a missing warehouse on a working
 * configuration. That is the same class of confidently-wrong diagnosis this preflight
 * exists to eliminate, so it now only asserts what is actually knowable.
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
    if (!(await verifyDelhiveryAuth())) {
      console.error(
        "[preflight] Delhivery rejected DELHIVERY_API_TOKEN. Shipping is broken until it is valid."
      );
      return;
    }

    console.log(
      `[preflight] Delhivery credentials OK, pickup name "${name}". Registration is not ` +
        `machine-verifiable — a wrong name fails at manifest time with ` +
        `"ClientWarehouse matching query does not exist".`
    );
  } catch (err: any) {
    console.warn(`[preflight] Could not verify Delhivery: ${err?.message ?? err}`);
  }
}

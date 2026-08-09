import fs from "fs";
import path from "path";
import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Dynamic layer over app.json. Everything static lives there; this file only
 * resolves `android.googleServicesFile`, which cannot be hardcoded.
 *
 * google-services.json holds real Firebase credentials, so it is gitignored and
 * absent on a fresh clone. Naming it statically in app.json makes EVERY Android
 * build fail outright with a file-not-found error. Resolving it here instead
 * means a missing file degrades to "no push notifications" plus a loud warning,
 * which is a far better failure mode than an unbuildable app.
 *
 * Lookup order:
 *   1. GOOGLE_SERVICES_JSON — a path, set automatically when the file is stored
 *      as an EAS file-type secret (the recommended setup for CI).
 *   2. ./google-services.json — a local copy downloaded from the Firebase console.
 */
function resolveGoogleServicesFile(): string | undefined {
  const fromEnv = process.env.GOOGLE_SERVICES_JSON;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;

  const local = path.resolve(__dirname, "google-services.json");
  if (fs.existsSync(local)) return local;

  console.warn(
    "\n[app.config] google-services.json not found.\n" +
      "  → Android push notifications will NOT work in this build.\n" +
      "  → Fix: download it from the Firebase console into apps/mobile/,\n" +
      "    or upload it as the EAS file secret GOOGLE_SERVICES_JSON.\n" +
      "  → See tasks/store-release.md, step 4.\n"
  );
  return undefined;
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? "Little Stepz",
  slug: config.slug ?? "mobile",
  android: {
    ...config.android,
    googleServicesFile: resolveGoogleServicesFile(),
  },
});

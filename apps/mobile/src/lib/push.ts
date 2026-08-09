import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { NotificationService } from "./services/notification.service";

/** Foreground display behaviour — show banner + list, play sound, bump badge. */
export function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  // Matches the `channelId: "default"` the backend sends with every push.
  // HIGH (not DEFAULT) so order/payment alerts pop as a heads-up banner instead of
  // landing silently in the tray. NOTE: a channel's importance is immutable once
  // created, so existing installs keep the old behaviour until the app is
  // reinstalled or the channel id is changed.
  await Notifications.setNotificationChannelAsync("default", {
    name: "Default",
    importance: Notifications.AndroidImportance.HIGH,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

function getProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as any)?.easConfig?.projectId
  );
}

async function getExpoToken(): Promise<string | null> {
  const projectId = getProjectId();
  const res = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  );
  return res.data || null;
}

/**
 * Requests permission, gets the Expo push token, and registers it with the
 * backend. Safe to call anywhere — returns null (never throws) on a simulator,
 * in Expo Go (remote push isn't supported there since SDK 53 → needs a dev
 * build), or when permission is denied. The in-app feed works regardless.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    if (!Device.isDevice) return null;
    await ensureAndroidChannel();

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== "granted") {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    if (status !== "granted") return null;

    const token = await getExpoToken();
    if (!token) return null;

    await NotificationService.registerDevice({
      token,
      platform: Platform.OS === "ios" ? "IOS" : "ANDROID",
      deviceName: Device.deviceName ?? undefined,
    });
    return token;
  } catch (err) {
    console.warn("[push] registration skipped:", (err as Error)?.message);
    return null;
  }
}

/**
 * Best-effort unregister of this device's token. Call while still authenticated
 * (before logout clears the access token) so the DELETE request succeeds.
 */
export async function unregisterPushNotifications(): Promise<void> {
  try {
    if (!Device.isDevice) return;
    const token = await getExpoToken();
    if (token) await NotificationService.unregisterDevice(token);
  } catch {
    // ignore — token may not exist (Expo Go / denied permission)
  }
}

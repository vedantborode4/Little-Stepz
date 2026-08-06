import AsyncStorage from "@react-native-async-storage/async-storage";

// Mirrors the web "guestSessionId" localStorage key used for guest-cart merge on login.
const GUEST_SESSION_KEY = "guestSessionId";

export async function getGuestSessionId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(GUEST_SESSION_KEY);
  } catch {
    return null;
  }
}

export async function setGuestSessionId(id: string): Promise<void> {
  try {
    await AsyncStorage.setItem(GUEST_SESSION_KEY, id);
  } catch {
    // ignore
  }
}

export async function clearGuestSessionId(): Promise<void> {
  try {
    await AsyncStorage.removeItem(GUEST_SESSION_KEY);
  } catch {
    // ignore
  }
}

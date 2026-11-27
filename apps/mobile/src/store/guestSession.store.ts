import { create } from "zustand";

export interface GuestContact {
  name: string;
  email: string;
  phone: string;
}

/** The API issues guest sessions for 2 hours; stop using one a little before that. */
const GUEST_SESSION_MS = 2 * 60 * 60 * 1000 - 5 * 60 * 1000;

interface GuestSessionState {
  token: string | null;
  contact: GuestContact | null;
  expiresAt: number | null;
  start: (token: string, contact: GuestContact) => void;
  clear: () => void;
}

/**
 * A guest checkout: a short-lived session for a shopper who chose not to sign in. Kept
 * apart from the real login (auth.store) so nothing treats a guest as signed in, and in
 * memory only, so it ends with the app process.
 */
export const useGuestSessionStore = create<GuestSessionState>((set) => ({
  token: null,
  contact: null,
  expiresAt: null,
  start: (token, contact) => set({ token, contact, expiresAt: Date.now() + GUEST_SESSION_MS }),
  clear: () => set({ token: null, contact: null, expiresAt: null }),
}));

/** The live guest token, or null (none, or expired — an expired one is cleared). */
export function getGuestTokenSync(): string | null {
  const { token, expiresAt, clear } = useGuestSessionStore.getState();
  if (!token) return null;
  if (!expiresAt || Date.now() > expiresAt) {
    clear();
    return null;
  }
  return token;
}

/** For components: whether a guest checkout session is active. */
export const useGuestSessionActive = () =>
  useGuestSessionStore((s) => !!s.token && !!s.expiresAt && Date.now() < s.expiresAt);

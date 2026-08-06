import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";

import { useAuth } from "./useAuth";
import { AuthService } from "../lib/services/auth.service";
import { toast } from "../store/toast.store";

// Required so the auth popup returns control to the app when it closes.
WebBrowser.maybeCompleteAuthSession();

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB;
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS;
const ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID;

/**
 * Whether Google auth is configured for the CURRENT platform. Must be a plain
 * function (no hooks) so callers can decide *not to render* the component that
 * runs `useIdTokenAuthRequest` — that hook throws at render if the platform's
 * client id is missing (e.g. "androidClientId must be defined").
 */
export function isGoogleConfigured(): boolean {
  if (Platform.OS === "android") return Boolean(ANDROID_CLIENT_ID);
  if (Platform.OS === "ios") return Boolean(IOS_CLIENT_ID);
  return Boolean(WEB_CLIENT_ID);
}

/**
 * Google sign-in via expo-auth-session (Expo Go-safe — no native module).
 * Returns an ID token which the backend (/auth/google) verifies and exchanges
 * for our normal session, then funnels through the shared `login()` path.
 */
export function useGoogleAuth(redirectTo: string = "/(tabs)/home") {
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: WEB_CLIENT_ID,
    iosClientId: IOS_CLIENT_ID,
    androidClientId: ANDROID_CLIENT_ID,
  });

  useEffect(() => {
    if (!response) return;

    if (response.type === "success") {
      const idToken = response.params?.id_token;
      if (idToken) {
        exchangeToken(idToken);
        return;
      }
      setLoading(false);
      toast.error("Google sign-in failed");
    } else if (response.type === "error") {
      setLoading(false);
      toast.error("Google sign-in failed");
    } else {
      // dismiss / cancel
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  const exchangeToken = async (idToken: string) => {
    try {
      const res = await AuthService.googleAuth(idToken);
      await login(res);
      router.replace(redirectTo as never);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    if (!request) return;
    setLoading(true);
    try {
      await promptAsync();
    } catch {
      setLoading(false);
    }
  };

  return {
    signInWithGoogle,
    loading,
    configured: Boolean(WEB_CLIENT_ID),
    ready: Boolean(request),
  };
}

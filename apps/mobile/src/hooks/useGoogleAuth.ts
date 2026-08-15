import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";

import { useAuth } from "./useAuth";
import {
  GOOGLE_REDIRECT_URI,
  completeGoogleAuth,
  platformGoogleClientId,
  savePendingGoogleAuth,
} from "../lib/auth/google-oauth";
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
/**
 * A placeholder is not a configuration. Treating "REPLACE_ME-ios..." as real would
 * render a Google button that always fails with an invalid-client error — worse
 * than not showing it. Real Google client ids always end in
 * `.apps.googleusercontent.com` and start with a numeric project number.
 */
function isRealClientId(id: string | undefined): boolean {
  if (!id) return false;
  if (!id.endsWith(".apps.googleusercontent.com")) return false;
  return /^\d+-/.test(id);
}

export function isGoogleConfigured(): boolean {
  if (Platform.OS === "android") return isRealClientId(ANDROID_CLIENT_ID);
  if (Platform.OS === "ios") return isRealClientId(IOS_CLIENT_ID);
  return isRealClientId(WEB_CLIENT_ID);
}

/**
 * Google sign-in via expo-auth-session (Expo Go-safe — no native module).
 *
 * The code exchange lives in `lib/auth/google-oauth` rather than here, because the
 * redirect can arrive after this component (and the whole JS context) is gone —
 * see the notes there. This hook owns opening the browser and the warm path;
 * `useGoogleOAuthCallback` at the root owns the cold path. Both funnel into the
 * same single-flight `completeGoogleAuth`.
 */
export function useGoogleAuth(redirectTo: string = "/(tabs)/home") {
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: WEB_CLIENT_ID,
    iosClientId: IOS_CLIENT_ID,
    androidClientId: ANDROID_CLIENT_ID,
    // Pinned, not derived — `makeRedirectUri` varies by execution environment.
    redirectUri: GOOGLE_REDIRECT_URI,
    // We redeem the code ourselves so the cold-start path can do it too.
    shouldAutoExchangeCode: false,
  });

  useEffect(() => {
    if (!response) return;

    if (response.type === "success" && response.params?.code) {
      void finishSignIn(response.params.code, response.params.state);
      return;
    }

    setLoading(false);
    if (response.type === "error") toast.error("Google sign-in failed");
    // dismiss / cancel needs no message
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  const finishSignIn = async (code: string, state?: string) => {
    try {
      const session = await completeGoogleAuth(code, state);
      // null → the deep-link listener already redeemed this code and navigated.
      if (!session) return;

      await login(session);
      router.replace(redirectTo as never);
    } catch (err: any) {
      toast.error(err?.message || "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    if (!request) return;
    setLoading(true);
    try {
      // Must be stored BEFORE the browser opens: Android may kill the app while
      // the user is on Google's page, and without the verifier the returned code
      // is unusable.
      await savePendingGoogleAuth({
        codeVerifier: request.codeVerifier ?? "",
        state: request.state ?? "",
        clientId: platformGoogleClientId() ?? "",
      });
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

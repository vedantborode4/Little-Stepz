import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { router } from "expo-router";
import * as AppleAuthentication from "expo-apple-authentication";

import { useAuth } from "./useAuth";
import { AuthService } from "../lib/services/auth.service";
import { toast } from "../store/toast.store";

/**
 * Whether Sign in with Apple can run here. False on Android, and false in Expo Go
 * (the entitlement only exists in a native build), so the button simply hides
 * during LAN development instead of erroring.
 */
export function useAppleAuthAvailable(): boolean {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    let active = true;
    AppleAuthentication.isAvailableAsync()
      .then((ok) => {
        if (active) setAvailable(ok);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return available;
}

/**
 * Sign in with Apple. Returns an identity token which the backend (/auth/apple)
 * verifies against Apple's JWKS and exchanges for our normal session, then
 * funnels through the shared `login()` path — same as Google.
 */
export function useAppleAuth(redirectTo: string = "/(tabs)/home") {
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);

  const signInWithApple = async () => {
    setLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        toast.error("Apple sign-in failed");
        return;
      }

      // `fullName` is populated ONLY on the first authorization for this app —
      // every later sign-in returns null, so it must be forwarded now or the
      // account is created without a name.
      const res = await AuthService.appleAuth({
        identityToken: credential.identityToken,
        givenName: credential.fullName?.givenName ?? undefined,
        familyName: credential.fullName?.familyName ?? undefined,
      });

      await login(res);
      router.replace(redirectTo as never);
    } catch (err: any) {
      // Dismissing the sheet is not an error worth surfacing.
      if (err?.code === "ERR_REQUEST_CANCELED") return;
      toast.error(err?.response?.data?.message || "Apple sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  return { signInWithApple, loading };
}

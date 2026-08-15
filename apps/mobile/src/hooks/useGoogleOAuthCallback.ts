import { useEffect } from "react";
import * as Linking from "expo-linking";
import { router } from "expo-router";

import { useAuth } from "./useAuth";
import { completeGoogleAuth, extractGoogleCallback } from "../lib/auth/google-oauth";
import { toast } from "../store/toast.store";

/**
 * Completes a Google sign-in from the incoming deep link, wherever it lands.
 *
 * Mounted once at the root so it covers both cases:
 *  - **warm** — the app stayed alive; `getInitialURL` is empty and the `url` event fires.
 *  - **cold** — Android killed the app inside the Google tab; the redirect relaunches
 *    it and the callback is only visible via `getInitialURL`.
 *
 * It deliberately does not depend on expo-router matching the callback path. The
 * router's link prefix is the app scheme, while the redirect uses the package-name
 * scheme, so relying on a route would tie sign-in to a detail we do not control.
 * `completeGoogleAuth` is single-flight, so this racing with the in-app response
 * handler is safe.
 */
export function useGoogleOAuthCallback() {
  const { login } = useAuth();

  useEffect(() => {
    let cancelled = false;

    const handle = async (url: string | null) => {
      const callback = extractGoogleCallback(url);
      if (!callback) return;

      try {
        const session = await completeGoogleAuth(callback.code, callback.state);
        // null means another handler already redeemed this code — it has navigated.
        if (!session || cancelled) return;

        await login(session);
        router.replace("/(tabs)/home");
      } catch (err) {
        if (cancelled) return;
        toast.error((err as Error)?.message || "Google sign-in failed");
        router.replace("/(auth)/signin");
      }
    };

    Linking.getInitialURL().then(handle).catch(() => {});
    const sub = Linking.addEventListener("url", (event) => {
      void handle(event.url);
    });

    return () => {
      cancelled = true;
      sub.remove();
    };
    // Mounted once for the app's lifetime; `login` is recreated every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

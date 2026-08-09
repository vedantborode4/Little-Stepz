import { useEffect, useRef } from "react";
import { router, useRootNavigationState } from "expo-router";
import * as Notifications from "expo-notifications";
import { useQueryClient } from "@tanstack/react-query";

import { useAuthStore } from "../store/auth.store";
import { registerForPushNotifications } from "../lib/push";
import { notificationRoute } from "../lib/notificationRoute";
import { qk } from "../lib/api/query-client";

/**
 * Wires push notifications for the app lifetime. Mounted once in the root layout:
 * - registers the Expo token with the backend when the user is authenticated
 * - refreshes the unread badge + feed when a push lands in the foreground
 * - deep-links to the relevant screen when a push is tapped (warm and cold start)
 */
export function usePushNotifications() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const qc = useQueryClient();

  // Identifiers of responses already routed. A cold-start tap is delivered twice —
  // once by getLastNotificationResponseAsync and once by the listener — which used
  // to push the same screen onto the stack twice.
  const routed = useRef<Set<string>>(new Set());

  // Navigating before the root navigator has mounted silently drops the link, so
  // a pending route is held until expo-router reports it is ready.
  const pending = useRef<string | null>(null);
  const navState = useRootNavigationState();
  const navReady = !!navState?.key;

  useEffect(() => {
    if (isAuthenticated) registerForPushNotifications();
  }, [isAuthenticated]);

  useEffect(() => {
    if (navReady && pending.current) {
      const route = pending.current;
      pending.current = null;
      router.push(route as never);
    }
  }, [navReady]);

  useEffect(() => {
    const handle = (resp: Notifications.NotificationResponse | null) => {
      if (!resp) return;
      const id = resp.notification.request.identifier;
      if (routed.current.has(id)) return;
      routed.current.add(id);

      const route = notificationRoute(
        resp.notification.request.content.data as Record<string, unknown>
      );
      if (!route) return;

      if (navReady) router.push(route as never);
      else pending.current = route as string;
    };

    const received = Notifications.addNotificationReceivedListener(() => {
      qc.invalidateQueries({ queryKey: qk.notificationsUnread });
      qc.invalidateQueries({ queryKey: qk.notifications });
    });

    const response = Notifications.addNotificationResponseReceivedListener(handle);

    // App launched by tapping a push (cold start).
    Notifications.getLastNotificationResponseAsync().then(handle).catch(() => {});

    return () => {
      received.remove();
      response.remove();
    };
  }, [qc, navReady]);
}

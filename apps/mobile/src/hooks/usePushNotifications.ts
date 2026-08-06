import { useEffect, useRef } from "react";
import { router } from "expo-router";
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
  const handledColdStart = useRef(false);

  useEffect(() => {
    if (isAuthenticated) registerForPushNotifications();
  }, [isAuthenticated]);

  useEffect(() => {
    const received = Notifications.addNotificationReceivedListener(() => {
      qc.invalidateQueries({ queryKey: qk.notificationsUnread });
      qc.invalidateQueries({ queryKey: qk.notifications });
    });

    const response = Notifications.addNotificationResponseReceivedListener((resp) => {
      const route = notificationRoute(
        resp.notification.request.content.data as Record<string, unknown>
      );
      if (route) router.push(route as never);
    });

    // App launched by tapping a push (cold start).
    Notifications.getLastNotificationResponseAsync().then((resp) => {
      if (!resp || handledColdStart.current) return;
      handledColdStart.current = true;
      const route = notificationRoute(
        resp.notification.request.content.data as Record<string, unknown>
      );
      if (route) router.push(route as never);
    });

    return () => {
      received.remove();
      response.remove();
    };
  }, [qc]);
}

import { Stack } from "expo-router";

/**
 * No guard here on purpose. "My Pre-Orders" and a pre-order's detail are account content
 * and guard themselves; `pay/[token]` is reached from the emailed balance link and pays
 * against the token, so it must open for a shopper who is not signed in — a layout guard
 * would bounce them to sign-in first.
 */
export default function PreOrdersLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

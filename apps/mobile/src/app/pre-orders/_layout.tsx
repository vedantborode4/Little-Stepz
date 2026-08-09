import { Stack } from "expo-router";
import { AuthGuard } from "../../components/guard/guards";

/** "My Pre-Orders" is account content — require sign-in. */
export default function PreOrdersLayout() {
  return (
    <AuthGuard>
      <Stack screenOptions={{ headerShown: false }} />
    </AuthGuard>
  );
}

import { Stack } from "expo-router";
import { AuthGuard } from "../../components/guard/guards";

export default function OrdersLayout() {
  return (
    <AuthGuard>
      <Stack screenOptions={{ headerShown: false }} />
    </AuthGuard>
  );
}

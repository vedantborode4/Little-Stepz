import { Stack } from "expo-router";
import { AuthGuard } from "../../components/guard/guards";

export default function CheckoutLayout() {
  return (
    <AuthGuard>
      <Stack screenOptions={{ headerShown: false }} />
    </AuthGuard>
  );
}

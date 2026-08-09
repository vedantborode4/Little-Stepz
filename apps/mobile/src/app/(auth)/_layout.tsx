import { Stack } from "expo-router";
import { GuestGuard } from "../../components/guard/guards";

export default function AuthLayout() {
  return (
    <GuestGuard>
      <Stack screenOptions={{ headerShown: false }} />
    </GuestGuard>
  );
}

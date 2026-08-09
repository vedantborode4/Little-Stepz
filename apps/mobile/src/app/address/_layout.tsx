import { Stack } from "expo-router";
import { AuthGuard } from "../../components/guard/guards";

export default function AddressLayout() {
  return (
    <AuthGuard>
      <Stack screenOptions={{ headerShown: false }} />
    </AuthGuard>
  );
}

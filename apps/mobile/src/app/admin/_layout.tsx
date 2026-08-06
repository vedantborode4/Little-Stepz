import { Stack } from "expo-router";
import { AdminGuard } from "../../components/guard/guards";

export default function AdminLayout() {
  return (
    <AdminGuard>
      <Stack screenOptions={{ headerShown: false }} />
    </AdminGuard>
  );
}

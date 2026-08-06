import { Stack } from "expo-router";
import { AuthGuard } from "../../components/guard/guards";

// Auth-only here; approval gating lives in AffiliateShell so /affiliate/apply
// stays reachable for non-approved users.
export default function AffiliateLayout() {
  return (
    <AuthGuard>
      <Stack screenOptions={{ headerShown: false }} />
    </AuthGuard>
  );
}

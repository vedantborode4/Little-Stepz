import { Redirect } from "expo-router";
import { useAuthStore } from "../../store/auth.store";

/** Wrap protected screens — redirects to sign-in when not authenticated. */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isHydrated } = useAuthStore();
  if (!isHydrated) return null;
  if (!isAuthenticated) return <Redirect href="/(auth)/signin" />;
  return <>{children}</>;
}

/** Wrap auth screens — redirects authenticated users away. */
export function GuestGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isHydrated } = useAuthStore();
  if (!isHydrated) return null;
  if (isAuthenticated) return <Redirect href="/(tabs)/home" />;
  return <>{children}</>;
}

/** Wrap admin screens — requires ADMIN role. */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isHydrated } = useAuthStore();
  if (!isHydrated) return null;
  if (!isAuthenticated) return <Redirect href="/(auth)/signin" />;
  if (user?.role !== "ADMIN") return <Redirect href="/(tabs)/home" />;
  return <>{children}</>;
}

import { Redirect, usePathname } from "expo-router";
import { useAuthStore } from "../../store/auth.store";

/**
 * Wrap protected screens — redirects to sign-in when not authenticated, carrying
 * the screen the user was trying to reach so they land there after signing in
 * instead of being dumped on Home.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const pathname = usePathname();

  if (!isHydrated) return null;
  if (!isAuthenticated) {
    return <Redirect href={{ pathname: "/(auth)/signin", params: { redirect: pathname } }} />;
  }
  return <>{children}</>;
}

/** Wrap auth screens — redirects authenticated users away. */
export function GuestGuard({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isHydrated = useAuthStore((s) => s.isHydrated);

  if (!isHydrated) return null;
  if (isAuthenticated) return <Redirect href="/(tabs)/home" />;
  return <>{children}</>;
}

/** Wrap admin screens — requires ADMIN role. */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const pathname = usePathname();

  if (!isHydrated) return null;
  if (!isAuthenticated) {
    return <Redirect href={{ pathname: "/(auth)/signin", params: { redirect: pathname } }} />;
  }
  if (user?.role !== "ADMIN") return <Redirect href="/(tabs)/home" />;
  return <>{children}</>;
}

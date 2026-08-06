import { View, Text } from "react-native";
import { Button } from "../ui/Button";
import { useGoogleAuth, isGoogleConfigured } from "../../hooks/useGoogleAuth";

/**
 * Renders "Continue with Google" only when Google auth is configured for this
 * platform. The config check is hook-free and gates whether `GoogleButton`
 * mounts at all — `useGoogleAuth` (via `useIdTokenAuthRequest`) throws at render
 * when the platform client id is missing, so it must not run when unconfigured.
 */
export function GoogleAuthButton({ redirectTo }: { redirectTo?: string }) {
  if (!isGoogleConfigured()) return null;
  return <GoogleButton redirectTo={redirectTo} />;
}

function GoogleButton({ redirectTo }: { redirectTo?: string }) {
  const { signInWithGoogle, loading, ready } = useGoogleAuth(redirectTo);

  return (
    <View className="mt-6">
      <View className="mb-4 flex-row items-center gap-3">
        <View className="h-px flex-1 bg-border" />
        <Text className="text-xs text-muted">or</Text>
        <View className="h-px flex-1 bg-border" />
      </View>

      <Button
        label="Continue with Google"
        variant="outline"
        loading={loading}
        disabled={!ready}
        onPress={signInWithGoogle}
      />
    </View>
  );
}

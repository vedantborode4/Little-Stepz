import { Button } from "../ui/Button";
import { useGoogleAuth, isGoogleConfigured } from "../../hooks/useGoogleAuth";

/**
 * Renders "Continue with Google" only when Google auth is configured for this
 * platform. The config check is hook-free and gates whether `GoogleButton`
 * mounts at all — `useGoogleAuth` (via `useIdTokenAuthRequest`) throws at render
 * when the platform client id is missing, so it must not run when unconfigured.
 *
 * The surrounding "or" divider lives in `SocialAuth`, which owns the whole
 * third-party block.
 */
export function GoogleAuthButton({ redirectTo }: { redirectTo?: string }) {
  if (!isGoogleConfigured()) return null;
  return <GoogleButton redirectTo={redirectTo} />;
}

function GoogleButton({ redirectTo }: { redirectTo?: string }) {
  const { signInWithGoogle, loading, ready } = useGoogleAuth(redirectTo);

  return (
    <Button
      label="Continue with Google"
      variant="outline"
      loading={loading}
      disabled={!ready}
      onPress={signInWithGoogle}
    />
  );
}

"use client"

import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { AuthService } from "../../lib/services/auth.service"
import { useAuth } from "../../hooks/use-auth"
import { friendlyError } from "../../lib/errorMessages"

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

export default function GoogleAuthButton({ redirectTo = "/" }: { redirectTo?: string }) {
  const router = useRouter()
  const { login } = useAuth()

  // Render nothing until the client ID is configured, so the page still works.
  if (!CLIENT_ID) return null

  const handleCredential = async (credential?: string) => {
    if (!credential) {
      toast.error("Google sign-in failed")
      return
    }
    try {
      const res = await AuthService.googleAuth(credential)
      await login(res)
      router.push(redirectTo)
    } catch (error) {
      toast.error(friendlyError(error, "Google sign-in failed"))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-black/10 dark:bg-white/15" />
        <span className="text-xs text-muted">or</span>
        <span className="h-px flex-1 bg-black/10 dark:bg-white/15" />
      </div>

      <div className="flex justify-center">
        <GoogleOAuthProvider clientId={CLIENT_ID}>
          <GoogleLogin
            onSuccess={(cred) => handleCredential(cred.credential)}
            onError={() => toast.error("Google sign-in failed")}
            text="continue_with"
            shape="pill"
            width="320"
          />
        </GoogleOAuthProvider>
      </div>
    </div>
  )
}

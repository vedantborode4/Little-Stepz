"use client"

import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { AuthService } from "../../lib/services/auth.service"
import { useAuth } from "../../hooks/use-auth"
import { friendlyError } from "../../lib/errorMessages"

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

export default function GoogleAuthButton({ redirectTo = "/" }: { redirectTo?: string }) {
  const router = useRouter()
  const { login } = useAuth()

  // Google renders a fixed-pixel button, so feed it the container's real width
  // (clamped to Google's 200–400 range) or it overflows narrow phones.
  const slotRef = useRef<HTMLDivElement>(null)
  const [slotWidth, setSlotWidth] = useState(0)

  useEffect(() => {
    const el = slotRef.current
    if (!el) return
    const measure = () => setSlotWidth(Math.min(400, Math.max(200, Math.floor(el.clientWidth))))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

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

      <div ref={slotRef} className="flex justify-center min-w-0 overflow-hidden">
        {slotWidth > 0 && (
          <GoogleOAuthProvider clientId={CLIENT_ID}>
            <GoogleLogin
              onSuccess={(cred) => handleCredential(cred.credential)}
              onError={() => toast.error("Google sign-in failed")}
              text="continue_with"
              shape="pill"
              width={String(slotWidth)}
            />
          </GoogleOAuthProvider>
        )}
      </div>
    </div>
  )
}

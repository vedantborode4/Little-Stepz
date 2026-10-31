import CrmShell from "@/components/shell/CrmShell"
import AuthGate from "@/features/auth/AuthGate"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <CrmShell>{children}</CrmShell>
    </AuthGate>
  )
}

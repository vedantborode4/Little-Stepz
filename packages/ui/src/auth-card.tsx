export function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-[420px] bg-white p-8 rounded-2xl shadow-card space-y-6">
      {children}
    </div>
  )
}

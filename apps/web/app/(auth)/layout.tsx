export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-bg">
      
      {/* LEFT PANEL */}
      <div className="hidden lg:flex flex-col justify-center px-20">
        <h1 className="text-primary">Little Stepz</h1>
        <p className="mt-4 text-muted max-w-sm">
          Discover toys that make learning joyful for every step of childhood.
        </p>
      </div>

      {/* FORM */}
      <div className="flex items-center justify-center p-6">
        {children}
      </div>
    </div>
  )
}

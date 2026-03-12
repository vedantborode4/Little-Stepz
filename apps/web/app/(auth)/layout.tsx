export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-bg">
      <div className="grid min-h-screen lg:grid-cols-2">

        {/* LEFT PANEL - Desktop */}
        <div className="hidden lg:flex flex-col justify-center px-20 bg-gradient-to-br from-primary/10 to-transparent">
          <div className="max-w-md">
            <img
              src="/logo.png"
              alt="Little Stepz"
              className="h-36 w-auto"
            />

            <p className="mt-6 text-lg text-muted leading-relaxed">
              Discover toys that make learning joyful for every
              step of childhood.
            </p>
          </div>
        </div>

        {/* RIGHT PANEL (FORM SIDE) */}
        <div className="flex flex-col justify-center items-center px-6 py-10 lg:px-16">

          {/* Mobile Branding */}
          <div className="lg:hidden mb-10 text-center">
            <h1 className="text-3xl font-bold text-primary">
              Little Stepz
            </h1>
            <p className="mt-2 text-sm text-muted">
              Joyful learning starts here ✨
            </p>
          </div>

          {/* Form Container */}
          <div className="w-full max-w-md">
            {children}
          </div>

        </div>
      </div>
    </div>
  )
}

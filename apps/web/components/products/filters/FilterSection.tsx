export default function FilterSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="border-b border-border pb-4 mb-4">
      <h3 className="font-semibold mb-3">{title}</h3>
      {children}
    </div>
  )
}

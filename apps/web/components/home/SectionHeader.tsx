export default function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-bold text-gray-900 text-center">{title}</h2>
      {subtitle && <p className="text-sm text-gray-400 mt-0.5 text-center">{subtitle}</p>}
    </div>
  )
}

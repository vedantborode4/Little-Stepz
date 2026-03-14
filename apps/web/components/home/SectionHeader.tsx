export default function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-2xl font-bold text-primary text-center">{title}</h2>
      {subtitle && <p className="text-md text-gray-400 mt-0.5 text-center">{subtitle}</p>}
    </div>
  )
}

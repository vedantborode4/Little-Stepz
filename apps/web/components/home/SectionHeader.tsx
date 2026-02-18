export default function SectionHeader({
  title,
}: {
  title: string
}) {
  return (
    <h2 className="text-2xl md:text-3xl font-bold text-center text-primary mb-10">
      {title}
    </h2>
  )
}

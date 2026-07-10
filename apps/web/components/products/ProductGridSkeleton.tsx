export default function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-6">
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="bg-surface-2 animate-pulse h-[300px] rounded-xl"
        />
      ))}
    </div>
  )
}

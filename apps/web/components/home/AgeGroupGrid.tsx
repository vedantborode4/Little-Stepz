import Link from "next/link"

const ages = [
  { label: "0-12 Months", value: "0-1" },
  { label: "1-3 Years", value: "1-3" },
  { label: "4-6 Years", value: "4-6" },
]

export default function AgeGroupGrid() {
  return (
    <section className="container text-center space-y-6">

      <div className="flex flex-wrap justify-center gap-8">
        {ages.map((a) => (
          <Link
            key={a.value}
            href={`/products?age=${a.value}`}
            className="space-y-2"
          >
            <div className="w-20 h-20 rounded-full bg-pink-100" />
            <p className="text-sm">{a.label}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}

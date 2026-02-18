import Link from "next/link"

const brands = [
  "marvel",
  "disney",
  "barbie",
  "hotwheels",
  "fisherprice",
]

export default function BrandStrip() {
  return (
    <section className="container text-center space-y-6">


      <div className="flex flex-wrap justify-center gap-8">
        {brands.map((b) => (
          <Link
            key={b}
            href={`/products?search=${b}`}
            className="opacity-70 hover:opacity-100 transition"
          >
            <img src={`/brands/${b}.png`} className="h-10" />
          </Link>
        ))}
      </div>
    </section>
  )
}

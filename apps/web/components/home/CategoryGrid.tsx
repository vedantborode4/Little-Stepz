import Link from "next/link"

const categories = [
    { name: "Dolls & Accessories", slug: "", img: "/cat/.png" },
    { name: "Cars & Vehicle Playsets", slug: "", img: "/cat/.png" },
    { name: "Cards & Board Games", slug: "", img: "/cat/.png" },
    { name: "Action Figures", slug: "", img: "/cat/.png" },
    { name: "Building & Construction", slug: "", img: "/cat/.png" },
    { name: "Learning & Educational", slug: "", img: "/cat/.png" },
    { name: "Soft Toys", slug: "", img: "/cat/.png" },
    { name: "Art & Craft", slug: "", img: "/cat/.png" },
]

export default function CategoryGrid() {
  return (
    <section className="container space-y-6 text-center">

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {categories.map((c) => (
          <Link
            key={c.slug}
            href={`/products?category=${c.slug}`}
            className="rounded-xl p-4 shadow-card bg-white"
          >
            <img src={c.img} />
            <p className="mt-2 text-sm font-medium">{c.name}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}

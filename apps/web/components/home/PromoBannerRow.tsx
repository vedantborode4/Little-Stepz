import Link from "next/link"
import Image from "next/image"

interface PromoItem {
  title: string
  image: string
  href: string
}

const promos: PromoItem[] = [
  {
    title: "Race into adventure",
    image: "/promos/promo1.png",
    href: "/products?search=hotwheels",
  },
  {
    title: "Barbie Collection",
    image: "/promos/promo2.png",
    href: "/products?search=barbie",
  },
  {
    title: "Marvel Super Heroes",
    image: "/promos/promo3.png",
    href: "/products?search=marvel",
  },
  {
    title: "Unleash Epic Battle",
    image: "/promos/promo4.png",
    href: "/products?search=nerf",
  },
]

export default function PromoBannerRow() {
  return (
    <section className="container">

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">

        {promos.map((promo) => (
          <Link
            key={promo.title}
            href={promo.href}
            className="relative group rounded-xl overflow-hidden block h-[160px] md:h-[180px] lg:h-[200px]"
          >
            {/* IMAGE */}
            <Image
              src={promo.image}
              alt={promo.title}
              fill
              className="object-cover group-hover:scale-105 transition duration-500"
            />

            {/* OVERLAY */}
            <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition" />

            {/* TEXT */}
            <div className="absolute bottom-4 left-4 text-white font-semibold text-sm md:text-base drop-shadow">
              {promo.title}
            </div>
          </Link>
        ))}

      </div>
    </section>
  )
}

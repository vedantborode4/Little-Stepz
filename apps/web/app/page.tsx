"use client"

import DynamicHeroBanner from "../components/home/DynamicHeroBanner"
import DynamicPromoBanner from "../components/home/DynamicPromoBanner"
import PromoBannerRow from "../components/home/PromoBannerRow"
import WhyChooseUs from "../components/home/WhyChooseUs"
import BestSellers from "../components/home/BestSellers"
import SectionHeader from "../components/home/SectionHeader"

export default function Home() {
  return (
    <main className="max-w-7xl mx-auto px-4 space-y-8 sm:space-y-14 py-4 sm:py-8">

      {/* 1. Hero sliding banners */}
      <DynamicHeroBanner />

      {/* 2. Categories */}
      <section>
        <SectionHeader title="Shop by Category" subtitle="Browse our full range of categories" />
        <PromoBannerRow />
      </section>

      {/* 3. Features (free shipping, easy returns, COD, secure payments) */}
      <section>
        <SectionHeader title="Why Shop With Us" />
        <WhyChooseUs />
      </section>

      {/* 4. Deals of the Day */}
      <section>
        <SectionHeader title="Deals of the Day" subtitle="Grab today's best prices" />
        <BestSellers sort="price_asc" />
      </section>

      {/* 5. Flash sale / promo banners */}
      <DynamicPromoBanner position="HOME_MID" />

      {/* 6. Best Sellers */}
      <section>
        <SectionHeader title="Best Sellers" subtitle="Our most loved products" />
        <BestSellers sort="newest" />
      </section>

      {/* 7. Footer is rendered globally in the root layout */}

    </main>
  )
}

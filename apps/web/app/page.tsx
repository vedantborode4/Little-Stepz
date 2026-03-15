"use client"

import DynamicHeroBanner from "../components/home/DynamicHeroBanner"
import DynamicPromoBanner from "../components/home/DynamicPromoBanner"
import PromoBannerRow from "../components/home/PromoBannerRow"
import WhyChooseUs from "../components/home/WhyChooseUs"
import BestSellers from "../components/home/BestSellers"
import SectionHeader from "../components/home/SectionHeader"
import { HeadingFor } from "../components/home/HeadingFor"

export default function Home() {
  return (
    <main className="max-w-7xl mx-auto px-4 space-y-14 py-8">

      {/* Hero banner — dynamic from CMS */}
      <DynamicHeroBanner />

      <section className="container">
        <HeadingFor />
      </section>

      {/* Shop by Category — static, no backend fetch */}
      <section>
        <SectionHeader title="Shop by Category" subtitle="Browse our full range of categories" />
        <PromoBannerRow />
      </section>


      {/* Mid-page dynamic banner from CMS */}
      <DynamicPromoBanner position="HOME_MID" />

      {/* Best Sellers — dynamic from real order data */}
      <section>
        <SectionHeader title="Best Sellers" subtitle="Our most loved products" />
        <BestSellers />
      </section>

      {/* Why choose us */}
      <section>
        <SectionHeader title="Why Choose Us" />
        <WhyChooseUs />
      </section>

    </main>
  )
}
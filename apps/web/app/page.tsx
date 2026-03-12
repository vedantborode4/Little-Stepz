"use client"

import { useEffect, useState } from "react"
import DynamicHeroBanner from "../components/home/DynamicHeroBanner"
import DynamicPromoBanner from "../components/home/DynamicPromoBanner"
import CategoryGrid from "../components/home/CategoryGrid"
import PromoBannerRow from "../components/home/PromoBannerRow"
import WhyChooseUs from "../components/home/WhyChooseUs"
import BestSellers from "../components/home/BestSellers"
import SectionHeader from "../components/home/SectionHeader"
import { CategoryService } from "../lib/services/category.service"
import { HeadingFor } from "../components/home/HeadingFor"

export default function Home() {
  const [categories, setCategories] = useState<any[]>([])

  useEffect(() => {
    CategoryService.getAll().then(setCategories).catch(() => {})
  }, [])

  return (
    <main className="max-w-7xl mx-auto px-4 space-y-14 py-8">

      {/* Hero banner — dynamic from CMS */}
      <DynamicHeroBanner />

        <section className="container">
          <HeadingFor/>
        </section>

      {/* Shop by Category */}
      {categories.length > 0 && (
        <section>
          <SectionHeader title="Shop by Category" subtitle="Browse our full range of categories" />
          <CategoryGrid categories={categories} />
        </section>
      )}

      {/* Promo banners row */}
      <PromoBannerRow />

      {/* Mid-page dynamic banner from CMS */}
      <DynamicPromoBanner position="HOME_MID" />

      {/* Best Sellers — dynamic from real order data */}
      <BestSellers />

      {/* Why choose us */}
      <section>
        <SectionHeader title="Why Shop With Us" />
        <WhyChooseUs />
      </section>

    </main>
  )
}

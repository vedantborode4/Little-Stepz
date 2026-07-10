"use client"

import DynamicHeroBanner from "../components/home/DynamicHeroBanner"
import MobileHeroBanner from "../components/home/MobileHeroBanner"
import DynamicPromoBanner from "../components/home/DynamicPromoBanner"
import PromoBannerRow from "../components/home/PromoBannerRow"
import WhyChooseUs from "../components/home/WhyChooseUs"
import BestSellers from "../components/home/BestSellers"
import PreOrderHome from "../components/home/PreOrderHome"
import CategorySection from "../components/home/CategorySection"
import SectionHeader from "../components/home/SectionHeader"
import AboutUs from "../components/home/AboutUs"
import WhyChooseLittleStepz from "../components/home/WhyChooseLittleStepz"

export default function Home() {
  return (
    <>
      {/* 1. Hero — full width. Mobile widths get the tall MOBILE_HERO banner; desktop keeps HOME_HERO. */}
      <div className="md:hidden">
        <MobileHeroBanner />
      </div>
      <div className="hidden md:block">
        <DynamicHeroBanner />
      </div>

      {/* 2. Categories — white */}
      <div className="max-w-7xl mx-auto px-4 py-8 sm:py-12">
        <SectionHeader title="Shop by Category" subtitle="Browse our full range of categories" />
        <PromoBannerRow />
      </div>

      {/* 3. Why Shop With Us — red band */}
      <section className="bg-bg">
        <div className="max-w-7xl mx-auto px-4 py-10 sm:py-14">
          <SectionHeader title="Why Shop With Us" />
          <WhyChooseUs />
        </div>
      </section>

      {/* 4. Best Sellers — 4-column grid · 5. Banner */}
      <div className="max-w-7xl mx-auto px-4 py-8 sm:py-12 space-y-10 sm:space-y-14">
        <section>
          <SectionHeader title="Best Sellers" subtitle="Our most-loved products" />
          <BestSellers sort="bestselling" layout="grid" limit={8} />
        </section>

        <DynamicPromoBanner position="HOME_MID" />
      </div>

      {/* 6. Pre-Order — 2-column slider (self-contained; self-hides when empty) */}
      <PreOrderHome />

      {/* 7. New Arrivals — 4×2 grid · 8. Stunt Cars — 3-column slider */}
      <div className="max-w-7xl mx-auto px-4 py-8 sm:py-12 space-y-10 sm:space-y-14">
        <section>
          <SectionHeader title="New Arrivals" subtitle="Fresh drops, just in" />
          <BestSellers sort="newest" layout="grid" limit={8} />
        </section>

        <CategorySection slug="stunt-cars" title="Stunt Cars" subtitle="Flips, spins and off-road tricks" layout="slider" columns={3} />
      </div>

      {/* 9. About Us — red band */}
      <section className="bg-bg">
        <div className="max-w-7xl mx-auto px-4 py-10 sm:py-14">
          <AboutUs />
        </div>
      </section>

      {/* 10. Licensed Cars — 4×2 grid (self-hides when empty) */}
      <div className="max-w-7xl mx-auto px-4 py-8 sm:py-12">
        <CategorySection slug="licensed-cars" title="Licensed Cars" subtitle="Officially licensed replicas" layout="grid" limit={8} />
      </div>

      {/* 11. Our Advantage — red band */}
      <WhyChooseLittleStepz />

      {/* Footer is rendered globally in the root layout */}
    </>
  )
}

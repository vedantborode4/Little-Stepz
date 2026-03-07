import Footer from "../components/layout/Footer"
import HeroCarousel from "../components/home/HeroCarousel"
import DynamicHeroBanner from "../components/home/DynamicHeroBanner"
import DynamicPromoBanner from "../components/home/DynamicPromoBanner"
import SectionHeader from "../components/home/SectionHeader"
import BrandRow from "../components/home/BrandRow"
import CategoryGrid from "../components/home/CategoryGrid"
import PromoBannerRow from "../components/home/PromoBannerRow"
import WhyChooseUs from "../components/home/WhyChooseUs"
import BestSellerSlider from "../components/home/BestSellerSlider"
import AgeGroupGrid from "../components/home/AgeGroupGrid"
import { Product } from "../types/product"
import { HeadingFor } from "../components/home/HeadingFor"

const bestSellerProducts: Product[] = [
  {
    id: "1",
    name: "Kids Running Shoes",
    price: 49.99,
    image: "/shoes1.jpg",
  },
  {
    id: "2",
    name: "Toddler Sneakers",
    price: "39.99",
    imageUR: "/shoes2.jpg",
  },
]


export default function Home() {
  return (
    <>

      <main className="max-w-7xl mx-auto px-4 space-y-20 py-10">

        {/* Hero — shows dynamic CMS banners if available, falls back to static carousel */}
        <DynamicHeroBanner />

        <section className="container">
          <HeadingFor/>
        </section>
        <section>
          <SectionHeader title="Shop By Brand" />
          <BrandRow />
        </section>

        <section>
          <SectionHeader title="Shop By Age Group" />
          <AgeGroupGrid />
        </section>

        <section>
          <SectionHeader title="Shop By Category" />
          <CategoryGrid />
        </section>

        <PromoBannerRow />

        {/* Dynamic mid-page promotional banners from CMS */}
        <DynamicPromoBanner position="HOME_MID" />

        <section>
          <SectionHeader title="Best Sellers" />
          <BestSellerSlider products={bestSellerProducts} />
        </section>

        <WhyChooseUs />
      </main>

      <Footer />
    </>
  )
}

"use client"

import Image from "next/image"
import { useEffect, useState } from "react"

interface Slide {
  image: string
  title?: string
}

const slides: Slide[] = [
  { image: "/hero/hero1.png" },
  { image: "/hero/hero2.png" },
  { image: "/hero/hero3.png" },
]

export default function HeroCarousel() {
  const [current, setCurrent] = useState(0)

  /* 🔁 autoplay */
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length)
    }, 4000)

    return () => clearInterval(timer)
  }, [])

  return (
    <div className="relative w-full h-[260px] md:h-[420px] rounded-2xl overflow-hidden">
      
      {/* SLIDES */}
      {slides.map((slide, index) => (
        <div
          key={index}
          className={`absolute inset-0 transition-opacity duration-700 ${
            index === current ? "opacity-100" : "opacity-0"
          }`}
        >
          <Image
            src={slide.image || "/hero/placeholder.png"}
            alt="Hero banner"
            fill
            priority={index === 0}
            className="object-cover"
          />
        </div>
      ))}

      {/* DOTS */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`h-2.5 w-2.5 rounded-full transition ${
              i === current ? "bg-white w-6" : "bg-white/50"
            }`}
          />
        ))}
      </div>
    </div>
  )
}

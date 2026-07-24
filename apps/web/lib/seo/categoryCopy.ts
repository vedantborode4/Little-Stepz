/**
 * Per-category SEO copy.
 *
 * Every one of the 16 categories in the live database has `description: null`,
 * so there is nothing to derive titles or meta descriptions from. This file is
 * the interim source of truth (proposal §4.3).
 *
 * Migration path: once `Category.metaTitle` / `metaDescription` / `description`
 * land (plan §3), seed the DB from this file and read from the DB instead —
 * keep the shape identical so the swap is a one-line change in the layout.
 *
 * `intro` doubles as GEO answer-layer copy (plan W10): each one is written to
 * stand alone as a citable passage, naming the brand and the category rather
 * than relying on surrounding page context.
 */

export interface CategoryCopy {
  title: string
  description: string
  h1: string
  intro: string
}

export const CATEGORY_COPY: Record<string, CategoryCopy> = {
  "licensed-cars": {
    title: "Officially Licensed RC Cars — Ferrari & More",
    description:
      "Officially licensed remote-control cars from Ferrari, Lamborghini, McLaren, Bugatti, Maserati, Mercedes-AMG and Land Rover. 1:12 and 1:14 scale, delivered across India.",
    h1: "Officially Licensed RC Cars",
    intro:
      "Little Stepz stocks officially licensed remote-control cars built under licence from the marque, including Ferrari, Lamborghini, McLaren, Bugatti, Maserati, Mercedes-AMG and Land Rover. Most models are 1:12 or 1:14 scale with 2.4GHz control and rechargeable battery packs. Licensed models reproduce the real car's bodywork, badging and proportions, which generic replicas cannot legally do.",
  },
  "rc-cars": {
    title: "RC Cars — Remote Control Cars Online",
    description:
      "Buy remote-control cars online at Little Stepz. Mini 1:60 and 1:64 RC drift cars, 2.4GHz control, rechargeable batteries. Shipped across India.",
    h1: "RC Cars",
    intro:
      "Little Stepz sells remote-control cars ranging from pocket-sized 1:64 drift models to full hobby-grade machines. All RC cars listed here use 2.4GHz radio control, which allows several cars to run at once without interference, and ship with rechargeable battery packs.",
  },
  "hyper-go-cars": {
    title: "MJX Hyper Go RC Cars — Brushless 4WD Crawlers",
    description:
      "MJX Hyper Go brushless 4WD RC rock crawlers and off-road trucks in 1:12, 1:14 and 1:18 scale. Hobby-grade performance, available at Little Stepz India.",
    h1: "MJX Hyper Go RC Cars",
    intro:
      "MJX Hyper Go is a hobby-grade RC line built around brushless motors and 4WD drivetrains. Brushless motors run cooler, last longer and deliver more top-end speed than the brushed motors used in toy-grade cars, which is why Hyper Go models sit at a higher price point than entry-level RC. Little Stepz stocks the H12P, H12Y and H18P Ford Bronco R crawlers.",
  },
  "rc-crawlers": {
    title: "RC Rock Crawlers — 4x4 & 6x6 Off-Road",
    description:
      "RC rock crawlers and off-road monster trucks in 1:14 and 1:16 scale. 4x4 and 6x6 drivetrains built for climbing rough terrain. Delivered across India.",
    h1: "RC Rock Crawlers",
    intro:
      "Rock crawlers are remote-control vehicles geared for torque rather than speed, with long-travel suspension and soft grippy tyres designed to climb obstacles instead of racing across flat ground. Little Stepz stocks 4x4 and 6x6 crawlers including spray-mist and high-speed buggy variants.",
  },
  "stunt-cars": {
    title: "Stunt RC Cars — Flips, Spins & Drift",
    description:
      "Remote-control stunt cars and monster trucks built for flips, 360-degree spins and off-road drift. High-speed 4WD models, shipped across India.",
    h1: "Stunt RC Cars",
    intro:
      "Stunt RC cars are built to roll, flip and spin without damage, using reinforced shells and double-sided chassis that keep driving when the car lands upside down. Little Stepz stocks 4WD high-speed monster trucks and off-road drift stunt cars.",
  },
  "die-cast-cars": {
    title: "Diecast Model Cars — 1:18 & 1:64 Scale Models",
    description:
      "Collector-grade diecast model cars — Porsche, McLaren, Bugatti, Nissan, Ford and Lamborghini. Metal bodies, detailed interiors. Buy online in India.",
    h1: "Diecast Model Cars",
    intro:
      "Diecast models are scale replicas cast in metal rather than moulded in plastic, which gives them weight, finish and detail that collectors value. Little Stepz stocks collector-grade diecast including Porsche 911 GT3 RS, RWB 964, McLaren MCL60, Bugatti Bolide, Nissan GT-R and Ford Mustang GTD.",
  },
  "hot-wheels": {
    title: "Hot Wheels Premium — 1:64 Collections",
    description:
      "Hot Wheels Premium 1:64 collections — Car Culture, Modern Classics, Team Transport and Formula 1 sets. Metal bases, Real Riders tyres. Buy online in India.",
    h1: "Hot Wheels Premium",
    intro:
      "Hot Wheels Premium differs from mainline Hot Wheels in construction: premium castings use metal bodies and metal bases, rubber Real Riders tyres, and licensed liveries, and are produced in limited runs for collectors. Little Stepz stocks Car Culture, Modern Classics, Team Transport and Formula 1 sets.",
  },
  blocks: {
    title: "Building Block Sets — Cars & Motorcycles",
    description:
      "Building block sets for cars, motorcycles and magnetic levitation tracks. Compatible brick systems for builders and display. Shipped across India.",
    h1: "Building Block Sets",
    intro:
      "Little Stepz stocks building-block kits covering formula racing cars, sports cars, retro cruiser and racing motorcycles, transformable mecha cars, and a 133-piece electric magnetic levitation track set. These are display-grade construction sets aimed at older builders rather than pre-school toys.",
  },
  "stanley-bottles": {
    title: "Stanley Quencher Tumblers — 40 oz",
    description:
      "Stanley Quencher H2.0 FlowState 40 oz tumblers, including Disney, Hello Kitty, Labubu and LoveShackFancy limited editions. Available at Little Stepz India.",
    h1: "Stanley Quencher Tumblers",
    intro:
      "The Stanley Quencher H2.0 FlowState is a 40 oz vacuum-insulated stainless steel tumbler with a rotating three-position lid and a handle sized for one-hand carry. Little Stepz stocks limited-edition collaborations including Disney, Hello Kitty, Labubu, Karol G, Jennie and LoveShackFancy. Limited editions are produced in fixed runs and are not restocked once sold out.",
  },
  "fidget-toys": {
    title: "Fidget Toys — Mechanical Spinners & Balls",
    description:
      "Mechanical fidget toys including press-to-spin balls and 3D-printed spinners. Compact desk toys for focus and stress relief. Delivered across India.",
    h1: "Fidget Toys",
    intro:
      "Little Stepz stocks mechanical fidget toys built around moving parts rather than electronics, including press-to-spin fidget balls and 3D-printed spinners. They are pocket-sized desk toys used for focus and stress relief.",
  },
  accessories: {
    title: "Accessories — Cables, Adapters & Add-Ons",
    description:
      "Accessories and add-ons including smart USB-C auto-charge-disconnect adapters. Practical extras for your devices and RC gear, shipped across India.",
    h1: "Accessories",
    intro:
      "Little Stepz stocks practical accessories and add-ons, including a smart USB-C adapter that cuts charging automatically once a battery is full, which reduces the overcharging that shortens battery life.",
  },
  raincard: {
    title: "Rain Card — Emergency Rain Poncho & Towel",
    description:
      "Rain Card compact emergency rain protection — disposable ponchos and instant rain towels that fit in a wallet or glovebox. Available across India.",
    h1: "Rain Card",
    intro:
      "Rain Card is a card-sized emergency rain product that folds into a wallet, glovebox or bag. Little Stepz stocks the disposable rain poncho and the instant rain towel — both intended as one-off backups rather than reusable rainwear.",
  },
  "home-and-lifestyle": {
    title: "Home & Lifestyle — Lighting & Living",
    description:
      "Home and lifestyle products including solar LED multi-colour garden projection lighting. Practical and decorative pieces, delivered across India.",
    h1: "Home & Lifestyle",
    intro:
      "Little Stepz stocks home and lifestyle pieces including solar-powered LED multi-colour garden projection lights, which charge in daylight and run at night without mains wiring.",
  },
  // Currently empty in the catalogue — copy is ready for when they are stocked.
  anime: {
    title: "Anime Figures & Collectibles",
    description:
      "Anime figures and collectibles at Little Stepz. Curated imports for collectors, delivered across India.",
    h1: "Anime Figures",
    intro:
      "Little Stepz curates anime figures and collectibles for Indian collectors. This category is currently being restocked.",
  },
  "e-learning-toys": {
    title: "Educational & E-Learning Toys",
    description:
      "Educational and e-learning toys that teach through play. Curated by Little Stepz and delivered across India.",
    h1: "Educational Toys",
    intro:
      "Little Stepz stocks educational and e-learning toys aimed at learning through play. This category is currently being restocked.",
  },
  transformers: {
    title: "Transformers — Convertible Robot Figures",
    description:
      "Transformers and convertible robot figures at Little Stepz. Collector and play grade, delivered across India.",
    h1: "Transformers",
    intro:
      "Little Stepz stocks Transformers and convertible robot figures. This category is currently being restocked.",
  },
}

export function categoryCopy(slug: string, name: string): CategoryCopy {
  return (
    CATEGORY_COPY[slug] ?? {
      title: `${name} — Buy Online`,
      description: `Shop ${name} at Little Stepz. Authentic products, directly imported and delivered across India.`,
      h1: name,
      intro: `Little Stepz stocks ${name}, directly imported and delivered across India.`,
    }
  )
}

import type { PolicyPage } from "../types";

export const warranty: PolicyPage = {
  slug: "warranty",
  title: "Warranty & Product Safety",
  intro:
    "Little Stepz offers limited warranty support only on eligible electronic products where explicitly mentioned. This page also covers important product, age, battery, and child safety guidance.",
  sections: [
    {
      heading: "Warranty Policy",
      blocks: [
        { type: "subheading", text: "Warranty Eligibility" },
        { type: "paragraph", text: "Warranty applies only to manufacturing defects for eligible products such as:" },
        {
          type: "list",
          items: [
            "RC Cars",
            "Electronic Toys",
            "Rechargeable Products",
            "Gaming Accessories",
            "Battery-Operated Devices",
            "Gadgets (where applicable)",
          ],
        },
        { type: "subheading", text: "Warranty Coverage" },
        { type: "paragraph", text: "Warranty may cover:" },
        {
          type: "list",
          items: [
            "Manufacturing defects",
            "Functional defects on first use",
            "Non-working electronic components due to factory issue",
          ],
        },
        { type: "subheading", text: "Warranty Does NOT Cover" },
        { type: "paragraph", text: "Warranty does not apply for:" },
        {
          type: "list",
          items: [
            "Physical damage",
            "Drops / accidental breakage",
            "Rough handling",
            "Water / liquid damage",
            "Wrong charging adapter usage",
            "Overcharging damage",
            "Battery misuse",
            "Voltage fluctuation damage",
            "Burn damage",
            "User tampering / repair attempts",
            "Wear & tear",
            "Consumable battery performance reduction over time",
          ],
        },
        { type: "subheading", text: "Claim Requirements" },
        { type: "paragraph", text: "For warranty claim review:" },
        {
          type: "list",
          items: [
            "Valid order proof required",
            "Product images/videos required",
            "Issue explanation required",
            "Technical verification may be requested",
          ],
        },
        { type: "subheading", text: "Warranty Decision" },
        {
          type: "paragraph",
          text: "Repair / replacement / support resolution will be provided based on issue verification. Little Stepz reserves final decision on warranty approval.",
        },
        { type: "subheading", text: "No Universal Warranty" },
        {
          type: "paragraph",
          text: "Unless specifically mentioned on the product page, products should not be assumed to carry extended warranty coverage.",
        },
      ],
    },
    {
      heading: "Product Safety Disclaimer",
      blocks: [
        {
          type: "paragraph",
          text: "At Little Stepz, customer safety is important to us. Our products include toys, electronic items, RC vehicles, collectibles, gaming accessories, educational products, and novelty items. Customers are requested to use products responsibly and as intended.",
        },
        { type: "subheading", text: "General Safety Notice" },
        {
          type: "list",
          items: [
            "Adult supervision is strongly recommended for young children",
            "Products should be used according to intended purpose only",
            "Improper handling may result in damage, malfunction, or injury",
            "Packaging materials should be kept away from children where applicable",
          ],
        },
        { type: "subheading", text: "Small Parts Warning" },
        {
          type: "paragraph",
          text: "Certain products may contain small parts, detachable accessories, screws, magnets, batteries, connectors, or components that may present choking hazards for young children. Keep away from children below the recommended age category unless under proper adult supervision.",
        },
        { type: "subheading", text: "Electronic Product Safety" },
        {
          type: "paragraph",
          text: "For electronic toys, RC products, rechargeable devices, gaming accessories, and battery-operated products:",
        },
        {
          type: "list",
          items: [
            "Use only recommended charging methods",
            "Do not overcharge products",
            "Keep away from water, moisture, extreme heat, or fire",
            "Do not attempt unauthorized repairs or modifications",
            "Damaged wires, batteries, or charging components should not be used",
          ],
        },
        { type: "subheading", text: "RC Product Safety" },
        { type: "paragraph", text: "For RC cars and moving electronic products:" },
        {
          type: "list",
          items: [
            "Use in safe open environments",
            "Avoid public roads, traffic zones, water exposure, stairs, fragile areas, or hazardous environments",
            "Keep away from pets, infants, and unsafe operating conditions",
          ],
        },
        { type: "subheading", text: "Magnetic Product Warning" },
        {
          type: "paragraph",
          text: "Products containing magnets must be used carefully. Swallowed magnets may cause serious internal injury. Seek immediate medical attention if magnets are swallowed.",
        },
        { type: "subheading", text: "Customer Responsibility" },
        { type: "paragraph", text: "By purchasing from Little Stepz, customers accept responsibility for:" },
        {
          type: "list",
          items: [
            "Proper product use",
            "Safe supervision where required",
            "Following instructions",
            "Appropriate age suitability decisions",
          ],
        },
        {
          type: "paragraph",
          text: "Limitation of Liability: Little Stepz shall not be responsible for injuries, misuse, improper handling, accidental damage, negligence, or unsafe usage beyond intended product conditions.",
        },
      ],
    },
    {
      heading: "Age Recommendation Policy",
      blocks: [
        {
          type: "paragraph",
          text: "Age recommendations provided on product pages are intended as general guidance only and may vary depending on product design, functionality, complexity, or safety considerations. Customers are advised to carefully review product descriptions, specifications, warnings, and suitability before purchase.",
        },
        { type: "paragraph", text: "Some products may be suitable for:" },
        {
          type: "list",
          items: ["Toddlers", "Young children", "Kids", "Teenagers", "Hobby users", "Adult collectors"],
        },
        { type: "subheading", text: "Adult Supervision" },
        {
          type: "paragraph",
          text: "Adult supervision is strongly recommended for younger children, especially when using products involving:",
        },
        {
          type: "list",
          items: [
            "Small detachable parts",
            "Batteries",
            "Magnets",
            "Electronic components",
            "Charging systems",
            "Fast-moving RC products",
            "Assembly-required items",
          ],
        },
        {
          type: "paragraph",
          text: "Certain products may not be suitable for children below specific ages due to choking hazards, operational complexity, fragile components, electronic risks, or collectible display-only nature. Parents / guardians are responsible for evaluating age suitability before purchase.",
        },
        {
          type: "paragraph",
          text: "Some action figures, anime collectibles, display models, premium figurines, hobby products, and collector items may be intended for display purposes rather than child play. Educational toys and STEM-related products may require age-appropriate guidance depending on product complexity.",
        },
        {
          type: "paragraph",
          text: "Little Stepz shall not be responsible for inappropriate age selection, improper supervision, misuse, or customer decisions regarding suitability.",
        },
      ],
    },
    {
      heading: "Battery Safety Policy",
      blocks: [
        {
          type: "paragraph",
          text: "Some products may include rechargeable batteries, replaceable batteries, battery-operated systems, electronic charging components, or power accessories. For safety and product longevity, customers must follow proper battery handling practices.",
        },
        { type: "subheading", text: "General Battery Safety" },
        {
          type: "list",
          items: [
            "Use batteries only as recommended for the specific product",
            "Insert batteries correctly according to polarity markings",
            "Do not mix old and new batteries",
            "Do not mix different battery types unless specifically allowed",
            "Remove batteries when the product is not in use for extended periods",
          ],
        },
        { type: "subheading", text: "Charging Safety" },
        {
          type: "list",
          items: [
            "Use only compatible charging cables, adapters, or charging accessories",
            "Avoid using damaged chargers or cables",
            "Do not overcharge products",
            "Disconnect charging once fully charged",
            "Do not leave charging products unattended for extended periods",
          ],
        },
        { type: "subheading", text: "Heat / Fire / Water Safety" },
        {
          type: "list",
          items: [
            "Keep batteries away from heat sources, fire, direct sunlight, or extreme temperatures",
            "Do not expose batteries or battery-operated products to water, moisture, or liquids",
            "Do not puncture, crush, modify, dismantle, or tamper with batteries",
          ],
        },
        { type: "subheading", text: "Child Safety" },
        {
          type: "list",
          items: [
            "Batteries must be kept away from children",
            "Small batteries may present choking hazards",
            "Swallowed batteries may cause serious injury and require immediate medical attention",
          ],
        },
        { type: "subheading", text: "Battery Damage / Swelling" },
        { type: "paragraph", text: "If a battery shows signs of swelling, leakage, overheating, burning smell, visible damage, or abnormal charging behavior, stop using the product immediately and seek appropriate assistance." },
        { type: "subheading", text: "Disposal Responsibility" },
        {
          type: "paragraph",
          text: "Used batteries should be disposed of responsibly according to local disposal regulations. Do not dispose batteries in fire or unsafe environments.",
        },
        {
          type: "paragraph",
          text: "Little Stepz shall not be responsible for damages, accidents, misuse, unsafe charging, improper battery handling, or negligence by users.",
        },
      ],
    },
    {
      heading: "Child Safety / Parental Supervision",
      blocks: [
        {
          type: "paragraph",
          text: "Many of our products are designed for fun, learning, creativity, entertainment, hobby use, or supervised play depending on product category. Parents, guardians, and responsible adults are strongly encouraged to review this guidance carefully.",
        },
        {
          type: "paragraph",
          text: "Certain products should be used only under proper adult supervision, especially where products involve small detachable parts, batteries, rechargeable charging systems, electronic components, magnets, moving mechanical parts, RC controls, assembly-required components, or fragile collectible parts.",
        },
        {
          type: "paragraph",
          text: "Not all products are suitable for all children. Parents / guardians are responsible for selecting products appropriate for the child's age, maturity, handling ability, safety awareness, and supervision level.",
        },
        {
          type: "paragraph",
          text: "Products containing magnets must be handled carefully. Swallowed magnets may cause severe injury requiring immediate medical attention.",
        },
        {
          type: "paragraph",
          text: "Little Stepz shall not be liable for injuries, unsafe handling, misuse, inadequate supervision, negligence, or inappropriate product selection.",
        },
      ],
    },
  ],
};

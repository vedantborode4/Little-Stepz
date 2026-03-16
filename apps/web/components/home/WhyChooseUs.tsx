import { Truck, ShieldCheck, BadgeCheck, Headphones } from "lucide-react"

const items = [
  { icon: Truck,        label: "Cash On Delivery",  desc: "Pay when you receive",       color: "bg-blue-50 text-blue-600" },
  { icon: Truck,        label: "Express Delivery",  desc: "Fast shipping nationwide",   color: "bg-green-50 text-green-600" },
  { icon: ShieldCheck,  label: "Secure Payments",   desc: "100% safe & encrypted",      color: "bg-purple-50 text-purple-600" },
  { icon: BadgeCheck,   label: "Quality Assurance", desc: "Curated & tested products",  color: "bg-yellow-50 text-yellow-600" },
]

export default function WhyChooseUs() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
      {items.map((item, index) => (
        <div key={index} className="bg-white border border-gray-200 rounded-2xl p-3 sm:p-5 text-center hover:shadow-md transition-shadow">
          <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center mx-auto mb-2 sm:mb-3 ${item.color}`}>
            <item.icon size={16} className="sm:w-[18px] sm:h-[18px]" />
          </div>
          <p className="font-semibold text-gray-900 text-xs sm:text-sm">{item.label}</p>
          <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5">{item.desc}</p>
        </div>
      ))}
    </div>
  )
}

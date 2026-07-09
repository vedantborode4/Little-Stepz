import { Truck, RotateCcw, Wallet, ShieldCheck } from "lucide-react"

const items = [
  { icon: Truck,        label: "Free Shipping",    desc: "On orders above ₹499",     color: "bg-green-50 dark:bg-green-500/15 text-green-600 dark:text-green-400" },
  { icon: RotateCcw,    label: "Easy Returns",     desc: "Hassle-free 7-day returns", color: "bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  { icon: Wallet,       label: "Cash On Delivery", desc: "Pay when you receive",      color: "bg-yellow-50 dark:bg-yellow-500/15 text-yellow-600 dark:text-yellow-400" },
  { icon: ShieldCheck,  label: "Secure Payments",  desc: "100% safe & encrypted",     color: "bg-purple-50 dark:bg-purple-500/15 text-purple-600 dark:text-purple-400" },
]

export default function WhyChooseUs() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
      {items.map((item, index) => (
        <div key={index} className="bg-surface border border-border rounded-2xl p-3 sm:p-5 text-center hover:shadow-md transition-shadow">
          <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center mx-auto mb-2 sm:mb-3 ${item.color}`}>
            <item.icon size={16} className="sm:w-[18px] sm:h-[18px]" />
          </div>
          <p className="font-semibold text-text text-xs sm:text-sm">{item.label}</p>
          <p className="text-[10px] sm:text-xs text-faint mt-0.5">{item.desc}</p>
        </div>
      ))}
    </div>
  )
}

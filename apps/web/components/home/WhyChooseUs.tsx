import { Truck, ShieldCheck, BadgeCheck } from "lucide-react"

export default function WhyChooseUs() {
  const items = [
    { icon: Truck, label: "Cash On Delivery" },
    { icon: Truck, label: "Express Delivery" },
    { icon: ShieldCheck, label: "Secure Payments" },
    { icon: BadgeCheck, label: "Quality Assurance" },
  ]

  return (
    <div className="bg-gray-100 rounded-2xl py-10 grid md:grid-cols-4 text-center gap-6">
      {items.map((i, index) => (
        <div key={index}>
          <i.icon className="mx-auto text-primary mb-2" />
          <p className="font-medium">{i.label}</p>
        </div>
      ))}
    </div>
  )
}

import Link from "next/link"
import { Mail, Phone, MapPin, Clock, LifeBuoy, ArrowRight } from "lucide-react"
import {
  BUSINESS_ADDRESS,
  SUPPORT_EMAIL,
  SUPPORT_HOURS,
  SUPPORT_PHONE_DISPLAY,
  SUPPORT_PHONE_E164,
  SUPPORT_RESPONSE_TIME,
  SUPPORT_WHATSAPP_URL,
} from "@repo/content/index"

import JsonLd from "../../components/seo/JsonLd"
import { pageMetadata } from "../../lib/seo/metadata"
import { breadcrumbSchema, contactPageSchema } from "../../lib/seo/schema"

export const metadata = pageMetadata({
  title: "Support & Contact",
  description:
    "Contact Little Stepz customer support by email, phone or WhatsApp for help with an order, delivery, return, refund or warranty claim. Support hours and business address.",
  path: "/support",
})

function WhatsAppIcon({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  )
}

const CHANNELS = [
  {
    label: "Email us",
    value: SUPPORT_EMAIL,
    note: "Best for order issues, returns and warranty claims — attach your order ID.",
    href: `mailto:${SUPPORT_EMAIL}`,
    icon: <Mail size={18} />,
    external: false,
  },
  {
    label: "Call us",
    value: SUPPORT_PHONE_DISPLAY,
    note: SUPPORT_HOURS,
    href: `tel:${SUPPORT_PHONE_E164}`,
    icon: <Phone size={18} />,
    external: false,
  },
  {
    label: "WhatsApp",
    value: SUPPORT_PHONE_DISPLAY,
    note: "Message us for quick questions about an existing order.",
    href: SUPPORT_WHATSAPP_URL,
    icon: <WhatsAppIcon size={17} />,
    external: true,
  },
]

const SELF_SERVE = [
  { label: "Track or manage an order", href: "/account/orders" },
  { label: "Shipping & delivery timelines", href: "/shipping" },
  { label: "Returns & refunds", href: "/returns" },
  { label: "Cancel an order", href: "/cancellation" },
  { label: "Warranty & safety", href: "/warranty" },
  { label: "Unboxing video requirement", href: "/unboxing-policy" },
  { label: "Frequently asked questions", href: "/faq" },
  { label: "Delete your account or data", href: "/data-deletion" },
]

export default function SupportPage() {
  return (
    <>
      <JsonLd
        schema={[
          contactPageSchema({
            path: "/support",
            name: "Support & Contact — Little Stepz",
            description:
              "Customer support contact details, hours and self-service help for Little Stepz orders.",
            hoursSpec: {
              dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
              opens: "10:00",
              closes: "18:00",
            },
          }),
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Support", path: "/support" },
          ]),
        ]}
      />

      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <LifeBuoy size={18} className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-text">Support &amp; Contact</h1>
        </div>

        <div className="bg-surface rounded-2xl border border-border shadow-card p-6 sm:p-8 space-y-8">
          <p className="text-sm text-muted leading-relaxed">
            Need help with an order, a delivery, a return or a product? Our support team is
            here for you. Reach us on any of the channels below — {SUPPORT_RESPONSE_TIME}
          </p>

          <section className="space-y-3">
            <h2 className="font-sans text-lg font-bold text-text">Contact us</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {CHANNELS.map((c) => (
                <a
                  key={c.label}
                  href={c.href}
                  {...(c.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="block rounded-xl border border-border p-4 hover:border-primary hover:bg-primary/5 transition"
                >
                  <span className="flex items-center gap-2 text-primary">
                    {c.icon}
                    <span className="text-xs font-semibold uppercase tracking-wide">
                      {c.label}
                    </span>
                  </span>
                  <span className="mt-2 block text-sm font-semibold text-text break-words">
                    {c.value}
                  </span>
                  <span className="mt-1 block text-xs text-muted leading-relaxed">{c.note}</span>
                </a>
              ))}
            </div>
          </section>

          <section className="space-y-2.5">
            <h2 className="font-sans text-lg font-bold text-text">Support hours</h2>
            <p className="flex items-start gap-2 text-sm text-muted leading-relaxed">
              <Clock size={16} className="text-faint shrink-0 mt-0.5" />
              <span>
                {SUPPORT_HOURS}. Messages received outside these hours are answered on the
                next working day. {SUPPORT_RESPONSE_TIME}
              </span>
            </p>
          </section>

          <section className="space-y-2.5">
            <h2 className="font-sans text-lg font-bold text-text">What to include</h2>
            <ul className="list-disc pl-5 space-y-1.5 text-sm text-muted leading-relaxed">
              <li>Your order ID, and the registered email or phone number on the account.</li>
              <li>
                For a damaged or wrong item, the unedited unboxing video — see our{" "}
                <Link href="/unboxing-policy" className="text-primary font-medium hover:underline">
                  Unboxing Policy
                </Link>
                .
              </li>
              <li>Photos of the product and the outer packaging, where relevant.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-sans text-lg font-bold text-text">Find an answer faster</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {SELF_SERVE.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="group flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 text-sm text-text hover:border-primary hover:bg-primary/5 transition"
                  >
                    <span>{item.label}</span>
                    <ArrowRight
                      size={15}
                      className="text-faint shrink-0 group-hover:text-primary transition"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-2.5">
            <h2 className="font-sans text-lg font-bold text-text">Registered business address</h2>
            <p className="flex items-start gap-2 text-sm text-muted leading-relaxed">
              <MapPin size={16} className="text-faint shrink-0 mt-0.5" />
              <span>
                Little Stepz
                <br />
                {BUSINESS_ADDRESS}
              </span>
            </p>
            <p className="text-xs text-faint leading-relaxed">
              Please do not send returns to this address without a confirmed return
              authorisation from our support team.
            </p>
          </section>
        </div>
      </div>
    </>
  )
}

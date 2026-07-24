import JsonLd from "../../components/seo/JsonLd"
import { FAQS } from "../../lib/seo/faqs"
import { pageMetadata } from "../../lib/seo/metadata"
import { breadcrumbSchema, faqSchema } from "../../lib/seo/schema"

export const metadata = pageMetadata({
  title: "FAQ — Shipping, Returns, COD & Warranty",
  description:
    "Answers to common Little Stepz questions: Cash on Delivery, delivery times across India, the unboxing-video requirement, returns eligibility, warranty and payment methods.",
  path: "/faq",
})

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd
        schema={[
          faqSchema(FAQS.map((f) => ({ question: f.q, answer: f.a }))),
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "FAQ", path: "/faq" },
          ]),
        ]}
      />
      {children}
    </>
  )
}

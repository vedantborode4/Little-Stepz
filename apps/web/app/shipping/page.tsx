import PolicyView from "../../components/policy/PolicyView"
import { pageMetadata } from "../../lib/seo/metadata"

export const metadata = pageMetadata({
  title: "Shipping Policy — Delivery & Charges",
  description:
    "How Little Stepz ships across India: dispatch timelines, delivery estimates of 2-7 business days, shipping charges, and how to track your order.",
  path: "/shipping",
})

export default function Page() {
  return <PolicyView slug="shipping" />
}

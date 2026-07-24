import PolicyView from "../../components/policy/PolicyView"
import { pageMetadata } from "../../lib/seo/metadata"

export const metadata = pageMetadata({
  title: "Terms & Conditions",
  description:
    "The terms governing use of littlestepz.in and purchases from Little Stepz, covering orders, pricing, payment, delivery, liability and governing law.",
  path: "/terms",
})

export default function Page() {
  return <PolicyView slug="terms" />
}

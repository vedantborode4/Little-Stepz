import PolicyView from "../../components/policy/PolicyView"
import { pageMetadata } from "../../lib/seo/metadata"

export const metadata = pageMetadata({
  title: "Returns & Refunds Policy",
  description:
    "Little Stepz accepts returns for damaged, defective or incorrect items with unboxing video proof. Read the eligibility rules, timelines and refund process.",
  path: "/returns",
})

export default function Page() {
  return <PolicyView slug="returns" />
}

import PolicyView from "../../components/policy/PolicyView"
import { pageMetadata } from "../../lib/seo/metadata"

export const metadata = pageMetadata({
  title: "Cancellation Policy",
  description:
    "Little Stepz order cancellations are accepted before dispatch. Read how to cancel, what happens after shipping, and how refunds are processed.",
  path: "/cancellation",
})

export default function Page() {
  return <PolicyView slug="cancellation" />
}

import PolicyView from "../../components/policy/PolicyView"
import { pageMetadata } from "../../lib/seo/metadata"

export const metadata = pageMetadata({
  title: "Privacy Policy",
  description:
    "How Little Stepz collects, uses, stores and protects your personal data, including payment information, cookies and your rights over your data.",
  path: "/privacy",
})

export default function Page() {
  return <PolicyView slug="privacy" />
}

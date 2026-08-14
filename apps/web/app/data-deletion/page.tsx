import PolicyView from "../../components/policy/PolicyView"
import { pageMetadata } from "../../lib/seo/metadata"

export const metadata = pageMetadata({
  title: "Account & Data Deletion",
  description:
    "How to request deletion of your Little Stepz account and personal data, what is deleted, and which transaction records we are required to retain.",
  path: "/data-deletion",
})

export default function Page() {
  return <PolicyView slug="data-deletion" />
}

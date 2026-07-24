import PolicyView from "../../components/policy/PolicyView"
import { pageMetadata } from "../../lib/seo/metadata"

export const metadata = pageMetadata({
  title: "Warranty & Safety Information",
  description:
    "Warranty cover on eligible electronics sold by Little Stepz, what manufacturing defects include, plus safety and age-suitability guidance for toys and RC cars.",
  path: "/warranty",
})

export default function Page() {
  return <PolicyView slug="warranty" />
}

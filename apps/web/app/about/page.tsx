import PolicyView from "../../components/policy/PolicyView"
import { pageMetadata } from "../../lib/seo/metadata"

export const metadata = pageMetadata({
  title: "About Us — Direct Importer in Hyderabad",
  description:
    "Little Stepz is a Hyderabad-based direct importer and retailer of premium toys, diecast models, officially licensed RC cars and collectibles, shipping across India.",
  path: "/about",
})

export default function Page() {
  return <PolicyView slug="about" />
}

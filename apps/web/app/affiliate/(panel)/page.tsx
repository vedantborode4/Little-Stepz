import AffiliateGuard from "../../../components/affiliate/AffiliateGuard"
import AffiliateDashboard from "../../../components/affiliate/AffiliateDashboard"

export default function Page() {
  return (
    <AffiliateGuard>
      <AffiliateDashboard />
    </AffiliateGuard>
  )
}
import AffiliateGuard from "../../../../components/affiliate/AffiliateGuard"
import CommissionHistory from "../../../../components/affiliate/CommissionHistory"
export default function Page() {
  return <AffiliateGuard><CommissionHistory /></AffiliateGuard>
}

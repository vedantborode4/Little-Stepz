import AffiliateGuard from "../../../../components/affiliate/AffiliateGuard"
import PayoutCard from "../../../../components/affiliate/PayoutCard"
export default function Page() {
  return <AffiliateGuard><PayoutCard /></AffiliateGuard>
}

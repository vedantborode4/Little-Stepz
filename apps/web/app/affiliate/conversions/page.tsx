import AffiliateGuard from "../../../components/affiliate/AffiliateGuard"
import ConversionsTable from "../../../components/affiliate/ConversionsTable"
export default function Page() {
  return <AffiliateGuard><ConversionsTable /></AffiliateGuard>
}

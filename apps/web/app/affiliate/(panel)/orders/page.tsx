import AffiliateGuard from "../../../../components/affiliate/AffiliateGuard"
import ReferredOrdersTable from "../../../../components/affiliate/ReferredOrdersTable"
export default function Page() {
  return <AffiliateGuard><ReferredOrdersTable /></AffiliateGuard>
}

import { ScreenContainer } from "../../components/layout/ScreenContainer";
import { AffiliateShell } from "../../features/affiliate/components/AffiliateShell";
import { PagedList } from "../../components/ui/PagedList";
import { DataListCard } from "../../components/ui/DataListCard";
import { ListTitle } from "../../features/affiliate/components/ListTitle";
import { useAffiliateConversions, normalizeItems } from "../../features/affiliate/hooks";
import { COMMISSION_STATUS } from "../../lib/enums";
import { formatDate, formatPrice, shortId } from "../../lib/utils/format";

export default function AffiliateConversions() {
  const query = useAffiliateConversions();
  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <AffiliateShell active="conversions">
        <PagedList
          query={query}
          header={<ListTitle title="Conversions" subtitle="Orders generated from your referrals" />}
          flatten={(d) => d.pages.flatMap((p: any) => normalizeItems(p))}
          keyExtractor={(it: any, i) => it.id ?? String(i)}
          emptyIcon="trending-up-outline"
          emptyTitle="No conversions yet"
          renderItem={(it: any) => (
            <DataListCard
              title={`Order #${shortId(it.orderId)}`}
              status={{ value: it.status, map: COMMISSION_STATUS }}
              rows={[
                { label: "Order total", value: it.order?.total != null ? formatPrice(it.order.total) : "—" },
                { label: "Date", value: formatDate(it.createdAt) },
              ]}
              amount={formatPrice(it.commission)}
            />
          )}
        />
      </AffiliateShell>
    </ScreenContainer>
  );
}

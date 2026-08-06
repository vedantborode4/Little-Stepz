import { ScreenContainer } from "../../components/layout/ScreenContainer";
import { AffiliateShell } from "../../features/affiliate/components/AffiliateShell";
import { PagedList } from "../../components/ui/PagedList";
import { DataListCard } from "../../components/ui/DataListCard";
import { ListTitle } from "../../features/affiliate/components/ListTitle";
import { useAffiliateCommissions, normalizeItems } from "../../features/affiliate/hooks";
import { COMMISSION_STATUS } from "../../lib/enums";
import { formatDate, formatPrice, shortId } from "../../lib/utils/format";

export default function AffiliateCommissions() {
  const query = useAffiliateCommissions();
  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <AffiliateShell active="commissions">
        <PagedList
          query={query}
          header={<ListTitle title="Commissions" subtitle="Track your earned commissions" />}
          flatten={(d) => d.pages.flatMap((p: any) => normalizeItems(p))}
          keyExtractor={(it: any, i) => it.id ?? String(i)}
          emptyIcon="cash-outline"
          emptyTitle="No commissions yet"
          renderItem={(it: any) => (
            <DataListCard
              title={`Order #${shortId(it.orderId)}`}
              status={{ value: it.status, map: COMMISSION_STATUS }}
              rows={[
                { label: "Order total", value: it.order?.total != null ? formatPrice(it.order.total) : "—" },
                { label: "Date", value: formatDate(it.createdAt) },
              ]}
              amount={formatPrice(it.amount)}
            />
          )}
        />
      </AffiliateShell>
    </ScreenContainer>
  );
}

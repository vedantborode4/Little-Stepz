import { ScreenContainer } from "../../components/layout/ScreenContainer";
import { AffiliateShell } from "../../features/affiliate/components/AffiliateShell";
import { PagedList } from "../../components/ui/PagedList";
import { DataListCard } from "../../components/ui/DataListCard";
import { ListTitle } from "../../features/affiliate/components/ListTitle";
import { useAffiliateOrders, normalizeItems } from "../../features/affiliate/hooks";
import { ORDER_STATUS } from "../../lib/enums";
import { formatDate, formatPrice, shortId } from "../../lib/utils/format";

export default function AffiliateOrders() {
  const query = useAffiliateOrders();
  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <AffiliateShell active="orders">
        <PagedList
          query={query}
          header={<ListTitle title="Referred Orders" subtitle="All orders placed by users you referred" />}
          flatten={(d) => d.pages.flatMap((p: any) => normalizeItems(p))}
          keyExtractor={(it: any, i) => it.id ?? it.orderId ?? String(i)}
          emptyIcon="bag-handle-outline"
          emptyTitle="No referred orders yet"
          renderItem={(it: any) => (
            <DataListCard
              title={`Order #${shortId(it.orderId ?? it.id)}`}
              status={{ value: it.status, map: ORDER_STATUS }}
              rows={[
                { label: "Date", value: formatDate(it.createdAt) },
                { label: "Order total", value: formatPrice(it.total ?? it.totalAmount ?? 0) },
                { label: "Payment", value: it.payment?.status ?? "—" },
                { label: "Your commission", value: formatPrice(it.commission ?? 0) },
              ]}
            />
          )}
        />
      </AffiliateShell>
    </ScreenContainer>
  );
}

import { ScreenContainer } from "../../components/layout/ScreenContainer";
import { AffiliateShell } from "../../features/affiliate/components/AffiliateShell";
import { PagedList } from "../../components/ui/PagedList";
import { DataListCard } from "../../components/ui/DataListCard";
import { ListTitle } from "../../features/affiliate/components/ListTitle";
import { useAffiliateClicks, normalizeItems } from "../../features/affiliate/hooks";
import { formatDateTime } from "../../lib/utils/format";

export default function AffiliateClicks() {
  const query = useAffiliateClicks();
  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <AffiliateShell active="clicks">
        <PagedList
          query={query}
          header={<ListTitle title="Clicks" subtitle="Unique visits from your referral link" />}
          flatten={(d) => d.pages.flatMap((p: any) => normalizeItems(p))}
          keyExtractor={(it: any, i) => it.id ?? String(i)}
          emptyIcon="finger-print-outline"
          emptyTitle="No clicks yet"
          renderItem={(it: any) => (
            <DataListCard
              title={formatDateTime(it.createdAt)}
              rows={[
                { label: "Source", value: it.referrer || it.source || "Direct" },
                ...(it.country ? [{ label: "Region", value: it.country }] : []),
                { label: "Unique", value: it.isUnique ? "Yes" : "No" },
              ]}
            />
          )}
        />
      </AffiliateShell>
    </ScreenContainer>
  );
}

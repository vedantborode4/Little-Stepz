import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { AffiliateService } from "./services/affiliate.service";
import { qk } from "../../lib/api/query-client";

export function useAffiliateMe() {
  return useQuery({ queryKey: qk.affiliateMe, queryFn: () => AffiliateService.getMe() });
}
export function useAffiliateStats() {
  return useQuery({ queryKey: qk.affiliateStats, queryFn: () => AffiliateService.getStats() });
}
export function useReferralLink() {
  return useQuery({ queryKey: qk.affiliateLink, queryFn: () => AffiliateService.getReferralLink() });
}

type Fetcher = (q?: Record<string, any>) => Promise<any>;

function pagedList(key: readonly unknown[], fetcher: Fetcher) {
  return useInfiniteQuery({
    queryKey: key as unknown[],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetcher({ page: pageParam, limit: 20 }),
    getNextPageParam: (last: any, pages) => {
      const items = normalizeItems(last);
      const pg = last?.pagination;
      if (pg && pg.page < pg.pages) return pg.page + 1;
      return items.length < 20 ? undefined : pages.length + 1;
    },
  });
}

export function normalizeItems(page: any): any[] {
  if (Array.isArray(page)) return page;
  if (!page) return [];
  return page.items ?? page.data ?? page.clicks ?? page.conversions ?? page.commissions ?? page.orders ?? [];
}

export const useAffiliateClicks = () => pagedList(qk.affiliateClicks, AffiliateService.getClicks);
export const useAffiliateConversions = () => pagedList(qk.affiliateConversions, AffiliateService.getConversions);
export const useAffiliateCommissions = () => pagedList(qk.affiliateCommissions, AffiliateService.getCommissions);
export const useAffiliateOrders = () => pagedList(qk.affiliateOrders, AffiliateService.getOrders);

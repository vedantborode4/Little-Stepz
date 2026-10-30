import { keepPreviousData, useQuery } from "@tanstack/react-query"
import type {
  DashboardDto,
  ProfitBreakdownRowDto,
  ProfitWaterfallDto,
  ReportDefinitionDto,
  ReportKey,
  ReportPreviewDto,
  ValuationDto,
} from "@repo/crm-schema"
import { getData } from "@/lib/api-client"

export const analyticsKeys = {
  all: ["analytics"] as const,
  dashboard: (params: object) => [...analyticsKeys.all, "dashboard", params] as const,
  profit: (params: object) => [...analyticsKeys.all, "profit", params] as const,
  breakdown: (params: object) => [...analyticsKeys.all, "breakdown", params] as const,
  valuation: (params: object) => [...analyticsKeys.all, "valuation", params] as const,
  reports: () => [...analyticsKeys.all, "reports"] as const,
  report: (key: string, params: object) => [...analyticsKeys.all, "report", key, params] as const,
}

export const useDashboard = (params: object) =>
  useQuery({
    queryKey: analyticsKeys.dashboard(params),
    queryFn: () => getData<DashboardDto>("/analytics/dashboard", params),
    placeholderData: keepPreviousData,
  })

export const useProfit = (params: { from: string; to: string }) =>
  useQuery({
    queryKey: analyticsKeys.profit(params),
    queryFn: () => getData<ProfitWaterfallDto>("/analytics/profit", params),
    placeholderData: keepPreviousData,
  })

export const useProfitBreakdown = (params: object) =>
  useQuery({
    queryKey: analyticsKeys.breakdown(params),
    queryFn: () => getData<ProfitBreakdownRowDto[]>("/analytics/breakdown", params),
    placeholderData: keepPreviousData,
  })

export const useValuation = (params: object) =>
  useQuery({
    queryKey: analyticsKeys.valuation(params),
    queryFn: () => getData<ValuationDto>("/analytics/valuation", params),
    placeholderData: keepPreviousData,
  })

export const useReports = () => useQuery({ queryKey: analyticsKeys.reports(), queryFn: () => getData<ReportDefinitionDto[]>("/reports") })

export const useReportPreview = (key: ReportKey | null, params: object) =>
  useQuery({
    queryKey: analyticsKeys.report(key ?? "", params),
    queryFn: () => getData<ReportPreviewDto>(`/reports/${key}`, params),
    enabled: Boolean(key),
    placeholderData: keepPreviousData,
  })

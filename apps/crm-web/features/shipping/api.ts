import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  CourierDto,
  CreateCourierInput,
  CreateShipmentInput,
  PackageInput,
  Paginated,
  ShipmentDetailDto,
  ShipmentListItemDto,
  ShipmentStatusInput,
  ShipmentSummaryDto,
  UpdateCourierInput,
  UpdateShipmentInput,
} from "@repo/crm-schema"
import { getData, sendData } from "@/lib/api-client"
import { inventoryKeys } from "../inventory/api"
import { catalogKeys } from "../products/api"
import { salesKeys } from "../sales/api"

export const shippingKeys = {
  all: ["shipping"] as const,
  list: (params: object) => [...shippingKeys.all, "list", params] as const,
  detail: (id: string) => [...shippingKeys.all, "detail", id] as const,
  summary: () => [...shippingKeys.all, "summary"] as const,
  couriers: (includeInactive: boolean) => [...shippingKeys.all, "couriers", includeInactive] as const,
}

export const useShipments = (params: object) =>
  useQuery({
    queryKey: shippingKeys.list(params),
    queryFn: () => getData<Paginated<ShipmentListItemDto>>("/shipments", params),
    placeholderData: keepPreviousData,
  })

export const useShipment = (id: string | null | undefined) =>
  useQuery({ queryKey: shippingKeys.detail(id ?? ""), queryFn: () => getData<ShipmentDetailDto>(`/shipments/${id}`), enabled: Boolean(id) })

export const useShipmentSummary = () =>
  useQuery({ queryKey: shippingKeys.summary(), queryFn: () => getData<ShipmentSummaryDto>("/shipments/summary") })

export const useCouriers = (includeInactive = false) =>
  useQuery({ queryKey: shippingKeys.couriers(includeInactive), queryFn: () => getData<CourierDto[]>("/couriers", { includeInactive }) })

/** Shipment moves can pack, dispatch or deliver the order (and move stock), so those caches refresh too. */
function useShippingMutation<TInput, TResult>(fn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const key of [shippingKeys.all, salesKeys.all, inventoryKeys.all, catalogKeys.all])
        queryClient.invalidateQueries({ queryKey: key })
    },
  })
}

export const useCreateShipment = () =>
  useShippingMutation((input: CreateShipmentInput) => sendData<ShipmentDetailDto>("post", "/shipments", input))
export const useUpdateShipment = (id: string) =>
  useShippingMutation((input: UpdateShipmentInput) => sendData<ShipmentDetailDto>("patch", `/shipments/${id}`, input))
export const useAddPackage = (id: string) =>
  useShippingMutation((input: PackageInput) => sendData<ShipmentDetailDto>("post", `/shipments/${id}/packages`, input))
export const useRemovePackage = (id: string) =>
  useShippingMutation((packageId: string) => sendData<ShipmentDetailDto>("delete", `/shipments/${id}/packages/${packageId}`))
export const useShipmentStatus = (id: string) =>
  useShippingMutation((input: ShipmentStatusInput) => sendData<ShipmentDetailDto>("post", `/shipments/${id}/status`, input))
export const useSaveCourier = () =>
  useShippingMutation(({ id, input }: { id?: string; input: CreateCourierInput | UpdateCourierInput }) =>
    id ? sendData<CourierDto>("patch", `/couriers/${id}`, input) : sendData<CourierDto>("post", "/couriers", input),
  )

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  BusinessProfileDto,
  BusinessProfileInput,
  CreateLocationInput,
  CreateReceivingAccountInput,
  LocationDto,
  ReceivingAccountDto,
  UpdateLocationInput,
  UpdateReceivingAccountInput,
} from "@repo/crm-schema"
import { getData, sendData } from "@/lib/api-client"

export const settingsKeys = {
  all: ["settings"] as const,
  profile: () => [...settingsKeys.all, "profile"] as const,
  locations: (includeInactive: boolean) => [...settingsKeys.all, "locations", { includeInactive }] as const,
  accounts: (includeInactive: boolean) => [...settingsKeys.all, "accounts", { includeInactive }] as const,
}

export const useBusinessProfile = () =>
  useQuery({ queryKey: settingsKeys.profile(), queryFn: () => getData<BusinessProfileDto | null>("/settings/business-profile") })

export const useLocations = (includeInactive = false) =>
  useQuery({
    queryKey: settingsKeys.locations(includeInactive),
    queryFn: () => getData<LocationDto[]>("/settings/locations", { includeInactive }),
  })

export const useReceivingAccounts = (includeInactive = false) =>
  useQuery({
    queryKey: settingsKeys.accounts(includeInactive),
    queryFn: () => getData<ReceivingAccountDto[]>("/settings/receiving-accounts", { includeInactive }),
  })

function useSettingsMutation<TInput, TResult>(fn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: () => queryClient.invalidateQueries({ queryKey: settingsKeys.all }) })
}

export const useSaveBusinessProfile = () =>
  useSettingsMutation((input: BusinessProfileInput) => sendData<BusinessProfileDto>("put", "/settings/business-profile", input))

export const useSaveLocation = () =>
  useSettingsMutation(({ id, input }: { id?: string; input: CreateLocationInput | UpdateLocationInput }) =>
    id ? sendData<LocationDto>("patch", `/settings/locations/${id}`, input) : sendData<LocationDto>("post", "/settings/locations", input),
  )

export const useSaveReceivingAccount = () =>
  useSettingsMutation(({ id, input }: { id?: string; input: CreateReceivingAccountInput | UpdateReceivingAccountInput }) =>
    id
      ? sendData<ReceivingAccountDto>("patch", `/settings/receiving-accounts/${id}`, input)
      : sendData<ReceivingAccountDto>("post", "/settings/receiving-accounts", input),
  )

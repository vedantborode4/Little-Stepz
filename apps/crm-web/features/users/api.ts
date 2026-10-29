import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { CreateUserInput, Paginated, ResetPasswordInput, UpdateUserInput, UserDto } from "@repo/crm-schema"
import { getData, sendData } from "@/lib/api-client"

export const userKeys = {
  all: ["users"] as const,
  list: (params: object) => [...userKeys.all, "list", params] as const,
}

export const useUsers = (params: object) =>
  useQuery({ queryKey: userKeys.list(params), queryFn: () => getData<Paginated<UserDto>>("/users", params), placeholderData: keepPreviousData })

function useUserMutation<TInput>(fn: (input: TInput) => Promise<UserDto>) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: () => queryClient.invalidateQueries({ queryKey: userKeys.all }) })
}

export const useCreateUser = () => useUserMutation((input: CreateUserInput) => sendData<UserDto>("post", "/users", input))
export const useUpdateUser = () =>
  useUserMutation(({ id, input }: { id: string; input: UpdateUserInput }) => sendData<UserDto>("patch", `/users/${id}`, input))
export const useResetPassword = () =>
  useUserMutation(({ id, input }: { id: string; input: ResetPasswordInput }) => sendData<UserDto>("post", `/users/${id}/reset-password`, input))

/** Readable temporary password that satisfies the policy (letters + digits, 12 chars). */
export function generateTemporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
  const digits = "23456789"
  const pick = (set: string) => set[crypto.getRandomValues(new Uint32Array(1))[0]! % set.length]
  return Array.from({ length: 8 }, () => pick(alphabet)).join("") + "-" + Array.from({ length: 3 }, () => pick(digits)).join("")
}

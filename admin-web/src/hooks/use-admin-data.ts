import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  createApiKey,
  createEpichustModel,
  createProvider,
  getAdminData,
  type CreateApiKeyRequest,
  type CreateEpichustModelRequest,
  type CreateProviderRequest,
} from "@/lib/api"

const adminDataQueryKey = ["admin-data"] as const

export function useAdminData() {
  return useQuery({
    queryKey: adminDataQueryKey,
    queryFn: getAdminData,
  })
}

export function useCreateEpichustModel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateEpichustModelRequest) => createEpichustModel(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminDataQueryKey })
    },
  })
}

export function useCreateProvider() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateProviderRequest) => createProvider(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminDataQueryKey })
    },
  })
}

export function useCreateApiKey() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateApiKeyRequest) => createApiKey(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminDataQueryKey })
    },
  })
}

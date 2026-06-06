import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  attachApiKeyMappingPolicy,
  createApiKey,
  createEpichustModel,
  createMappingPolicy,
  createProvider,
  createProviderModel,
  deleteMappingPolicy,
  detachApiKeyMappingPolicy,
  getAdminData,
  updateMappingPolicy,
  type AttachApiKeyMappingPolicyRequest,
  type CreateApiKeyRequest,
  type CreateEpichustModelRequest,
  type CreateMappingPolicyRequest,
  type CreateProviderModelRequest,
  type CreateProviderRequest,
  type UpdateMappingPolicyRequest,
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

export function useCreateProviderModel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateProviderModelRequest) => createProviderModel(input),
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

export function useCreateMappingPolicy() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateMappingPolicyRequest) => createMappingPolicy(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminDataQueryKey })
    },
  })
}

export function useUpdateMappingPolicy() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: UpdateMappingPolicyRequest
    }) => updateMappingPolicy(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminDataQueryKey })
    },
  })
}

export function useDeleteMappingPolicy() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteMappingPolicy(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminDataQueryKey })
    },
  })
}

export function useAttachApiKeyMappingPolicy() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      apiKeyId,
      input,
    }: {
      apiKeyId: string
      input: AttachApiKeyMappingPolicyRequest
    }) => attachApiKeyMappingPolicy(apiKeyId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminDataQueryKey })
    },
  })
}

export function useDetachApiKeyMappingPolicy() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      apiKeyId,
      mappingPolicyId,
    }: {
      apiKeyId: string
      mappingPolicyId: string
    }) => detachApiKeyMappingPolicy(apiKeyId, mappingPolicyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminDataQueryKey })
    },
  })
}
